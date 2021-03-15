import { ConfigFile, ConfigValue, fs, Logger, SfdxError, SfdxProject } from '@salesforce/core';
import { AnyJson, Dictionary, get, Nullable } from '@salesforce/ts-types';
import { join } from 'path';
import { SourcePathInfo } from './sourcePathStatusManager';
import { ChangeElement, RemoteSourceTrackingService } from './remoteSourceTrackingService';
import MetadataRegistry = require('./metadataRegistry');

const XmlParser = require('fast-xml-parser');

export type NonDecomposedElement = ConfigValue & {
  fullName: string;
  type: string;
  metadataFilePath: string;
};

export namespace NonDecomposedElementsIndex {
  export interface Options extends ConfigFile.Options {
    username: string;
    metadataRegistry: MetadataRegistry;
  }
}

const NON_DECOMPOSED_CONFIGS = {
  CustomLabels: [
    {
      childType: 'CustomLabel',
      xmlTag: 'CustomLabels[0].labels',
      namePath: 'fullName'
    }
  ]
};

/**
 * NonDecomposedElementsIndex maintains an index of non-decomposed elements (e.g. CustomLabel) at
 * <project_dir>/.sfdx/orgs/<username>/nonDecomposedElementsIndex.json.
 *
 * The purpose of this is to be able to figure out which elements belong to which file. So for example,
 * if we have CustomLabels files in two separate packages, we can use this index to determine which
 * labels to put into the package.xml when executing a retrieve or a pull.
 *
 * We use the NON_DECOMPOSED_CONFIGS to determine which metadata types need to be read and stored into the index.
 *   - The keys (e.g. CustomLabels) are the aggregate metadata types. This tells us which meta files we need to read.
 *   - childType refers to the metadata type of the elements inside the meta file
 *   - xmlTag tells us where to find the elements inside the xml
 *   - namePath tells us where to find the name of the element
 */
export class NonDecomposedElementsIndex extends ConfigFile<NonDecomposedElementsIndex.Options> {
  logger!: Logger;
  private static _instances: Dictionary<NonDecomposedElementsIndex> = {};
  private includedFiles: Set<string> = new Set();
  private metadataRegistry: MetadataRegistry;
  private hasChanges = false;
  private remoteSourceTrackingService: RemoteSourceTrackingService;

  public static async getInstance(options: NonDecomposedElementsIndex.Options): Promise<NonDecomposedElementsIndex> {
    if (!this._instances[options.username]) {
      this._instances[options.username] = await NonDecomposedElementsIndex.create(options);
    }
    return this._instances[options.username];
  }

  public static getFileName(): string {
    return 'nonDecomposedElementsIndex.json';
  }

  protected async init() {
    this.options.filePath = join('orgs', this.options.username);
    this.options.filename = NonDecomposedElementsIndex.getFileName();
    this.logger = await Logger.child(this.constructor.name);
    this.metadataRegistry = this.options.metadataRegistry;
    this.remoteSourceTrackingService = await RemoteSourceTrackingService.getInstance({
      username: this.options.username
    });
    await super.init();
    this.populateIncludedFiles();
  }

  public populateIncludedFiles() {
    this.values().forEach(v => this.includedFiles.add(v.metadataFilePath));
  }

  public async addElement(metadataName: string, fullName: string, sourcePath: string) {
    const key = MetadataRegistry.getMetadataKey(metadataName, fullName);
    const value = {
      fullName,
      type: metadataName,
      metadataFilePath: sourcePath
    };
    if (!this.has(key)) {
      this.set(key, value);
    }
  }

  public getMetadataFilePath(key: string): Nullable<string> {
    const value = this.get(key);
    return value ? value.metadataFilePath : null;
  }

  /**
   * Returns true if the metadata type contains non-decomposed elements
   * that we want to put into the index.
   */
  public isNonDecomposedElement(metadataName: string): boolean {
    return NonDecomposedElementsIndex.isSupported(metadataName);
  }

  public static isSupported(metadataName: string): boolean {
    return NON_DECOMPOSED_CONFIGS.hasOwnProperty(metadataName);
  }

  /**
   * Returns true if the provided sourcePath is in this.includedFiles.
   * If a file is in this.includedFiles, that means that the index has
   * already read that file
   */
  public isIncludedFile(sourcePath: string): boolean {
    return this.includedFiles.has(sourcePath);
  }

  /**
   * Returns true if the file has NOT changed or is NOT new
   */
  private shouldSkip(sourcePathInfo: SourcePathInfo): boolean {
    return !(sourcePathInfo.isChanged() || sourcePathInfo.isNew()) && this.isIncludedFile(sourcePathInfo.sourcePath);
  }

  /**
   * Adds the non-decomposed elements within a sourcePath to the index
   *
   * If the given sourcePath is supported, then we:
   *  - read the xml
   *  - parse the xml for the non-decomposed elements
   *  - add all those elements to the index
   *
   * We skip this process if:
   *  - the sourcePath belongs to a metadata type that doesn't have non-decomposed elements
   *  - OR the sourcePath hasn't changed since the last time we read it
   *
   * Set the refresh flag to true if you want to force update the index
   */
  public async handleDecomposedElements(sourcePathInfo: SourcePathInfo, refresh = false) {
    if (!refresh && this.shouldSkip(sourcePathInfo)) return;

    const metadataType = this.metadataRegistry.getTypeDefinitionByFileName(sourcePathInfo.sourcePath);
    const configs = NON_DECOMPOSED_CONFIGS[metadataType.metadataName];
    const contents = await this.readXmlAsJson(sourcePathInfo.sourcePath);
    for (const config of configs) {
      const elements = get(contents, config.xmlTag, []) as AnyJson[];
      for (const element of elements) {
        const fullName = get(element, config.namePath) as string;
        if (fullName) {
          await this.addElement(metadataType.metadataName, fullName, sourcePathInfo.sourcePath);
        }
      }
    }
    this.write();
  }

  /**
   * Unsets elements with a metadataFilePath that matches the provided sourcePath
   */
  public clearElements(sourcePath: string) {
    const matchingElements = this.getElementsByMetadataFilePath(sourcePath);
    matchingElements.forEach(element => {
      const key = MetadataRegistry.getMetadataKey(element.type, element.fullName);
      this.unset(key);
    });
  }

  /**
   * Returns JSON representation of an xml file
   */
  private async readXmlAsJson(sourcePath: string): Promise<AnyJson> {
    const contents = await fs.readFile(sourcePath, 'utf-8');
    try {
      return XmlParser.parse(contents, { arrayMode: true });
    } catch (err) {
      throw SfdxError.create('salesforce-alm', 'source', 'XmlParsingError', [`; ${err.message}`]);
    }
  }

  /**
   * Synchronously read a source file and look for a specific metadata key contained within it,
   * returning `true` if found.  If the metadata key is a type unknown to this index, or if there
   * is a problem reading/parsing the source file, an error will be logged.
   *
   * @param sourcePath The path to the source file.
   * @param mdKey The metadata key to search within the source file.  E.g., CustomLabels__MyLabelName
   */
  public static belongsTo(sourcePath: string, mdKey: string): boolean {
    let belongs = false;

    try {
      const [mdType, mdName] = mdKey.split('__');

      const configs = NON_DECOMPOSED_CONFIGS[mdType];
      if (!configs) {
        throw new Error(`Unsupported NonDecomposedIndex type: ${mdType}`);
      }

      const contents = fs.readFileSync(sourcePath, 'utf-8');
      const jsonContents: AnyJson = XmlParser.parse(contents, { arrayMode: true });

      for (const config of configs) {
        const elements = get(jsonContents, config.xmlTag, []) as AnyJson[];
        for (const element of elements) {
          const fullName = get(element, config.namePath) as string;
          if (fullName === mdName) {
            belongs = true;
            break;
          }
        }
      }
    } catch (err) {
      const logger = Logger.childFromRoot(this.constructor.name);
      logger.debug(
        `Encountered an error reading/parsing source path: ${sourcePath} for ${mdKey} due to:\n${err.stack}`
      );
    }

    return belongs;
  }

  /**
   * Given an array of ChangeElements, find all changeElements that live in the same file location.
   * For example, given a custom label this will return all custom labels that live in the same CustomLabels
   * meta file.
   */
  public getRelatedNonDecomposedElements(changeElements: ChangeElement[]): ChangeElement[] {
    const elements: ChangeElement[] = [];
    const seen = new Set<string>();
    const contents = this.values();

    const isRelatedElement = function(
      existingElement: NonDecomposedElement,
      comparisonElement: NonDecomposedElement
    ): boolean {
      return (
        existingElement.metadataFilePath === comparisonElement.metadataFilePath &&
        existingElement.fullName !== comparisonElement.fullName &&
        !seen.has(comparisonElement.fullName)
      );
    };

    for (const changeElement of changeElements) {
      const metadataType = this.metadataRegistry.getTypeDefinitionByMetadataName(changeElement.type);
      if (metadataType && NonDecomposedElementsIndex.isSupported(metadataType.metadataName)) {
        const key = MetadataRegistry.getMetadataKey(metadataType.metadataName, changeElement.name);
        const element = this.get(key);

        contents.forEach(item => {
          const shouldAdd = this.has(key) ? isRelatedElement(element, item) : this.elementBelongsToDefaultPackage(item);

          if (shouldAdd) {
            seen.add(item.fullName);
            const trackedElement = this.remoteSourceTrackingService.getTrackedElement(key);
            const isNameObsolete = trackedElement ? trackedElement.deleted : false;
            elements.push({
              type: changeElement.type,
              name: item.fullName,
              deleted: isNameObsolete
            });
          }
        });
      }
    }
    return elements;
  }

  /**
   * Returns all elements in the index that have a given metadataFilePath
   */
  public getElementsByMetadataFilePath(metadataFilePath: string): NonDecomposedElement[] {
    if (!this.isIncludedFile(metadataFilePath)) {
      return [];
    }
    const elements = [...this.values()];
    return elements.filter(element => {
      return element.metadataFilePath === metadataFilePath;
    });
  }

  /**
   * Refreshes the index IF the inboundFiles contain any paths that have
   * been previously added to the index.
   */
  public async maybeRefreshIndex(inboundFiles: any[]): Promise<void> {
    const results = inboundFiles.filter(c => !c.fullName.includes('xml'));

    const supportedTypes = results.filter(r => {
      return NonDecomposedElementsIndex.isSupported(decodeURIComponent(r.fullName));
    });

    if (supportedTypes.length) {
      const sourcePaths = supportedTypes.map(r => r.filePath);
      return this.refreshIndex(sourcePaths);
    }
  }

  /**
   * Refreshes the index using the provided sourcePaths. If no sourcePaths
   * are provided then it will default to refreshing files that have already
   * been indexed (this.includedFiles)
   */
  public async refreshIndex(sourcePaths?: string[]): Promise<void> {
    const paths = sourcePaths || this.includedFiles;
    for (const sourcePath of paths) {
      if (await fs.fileExists(sourcePath)) {
        this.clearElements(sourcePath);
        await this.handleDecomposedElements({ sourcePath } as SourcePathInfo, true);
      } else {
        this.deleteEntryBySourcePath(sourcePath);
      }
    }
  }

  /**
   * Returns true if the given nonDecomposedElements belongs to the default package
   */
  private elementBelongsToDefaultPackage(nonDecomposedElement: NonDecomposedElement): boolean {
    const defaultPackage = SfdxProject.getInstance().getDefaultPackage().name;
    const elementPackage = SfdxProject.getInstance().getPackageNameFromPath(nonDecomposedElement.metadataFilePath);
    return defaultPackage === elementPackage;
  }

  public deleteEntryBySourcePath(path: string): void {
    try {
      const elements = this.getElementsByMetadataFilePath(path);
      elements.forEach(element => {
        this.unset(`${element.type}__${element.fullName}`);
      });
    } catch (e) {
      // if it's already been deleted, don't throw an error when trying to delete it again
      // but if it's a different error, throw it!
      if (e.message !== 'Cannot convert undefined or null to object') {
        this.logger.debug(`An error occured when trying to delete ${path} from the nonDecomposedElementsIndex`);
        throw SfdxError.wrap(e);
      }
    }
  }

  public async write() {
    if (!this.hasChanges) return;
    this.hasChanges = false;
    return super.write();
  }

  public get(key: string): NonDecomposedElement {
    return super.get(key) as NonDecomposedElement;
  }

  public set(key: string, value: NonDecomposedElement) {
    super.set(key, value);
    this.includedFiles.add(value.metadataFilePath);
    this.hasChanges = true;
    return this.getContents();
  }

  public values(): NonDecomposedElement[] {
    return (super.values() as unknown) as NonDecomposedElement[];
  }
}

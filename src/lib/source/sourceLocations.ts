import { Logger, SfdxProject } from '@salesforce/core';
import { AsyncCreatable, isEmpty } from '@salesforce/kit';
import { Nullable } from '@salesforce/ts-types';
import { MetadataType } from './metadataType';
import { MetadataTypeFactory, MetadataTypeCache } from './metadataTypeFactory';
import { SourcePathInfo } from './sourcePathStatusManager';
import { isString } from 'util';
import MetadataRegistry = require('./metadataRegistry');
import { NonDecomposedElementsIndex } from './nonDecomposedElementsIndex';

interface SourceLocationsOptions {
  metadataRegistry: MetadataRegistry;
  sourcePathInfos: SourcePathInfo[];
  shouldBuildIndices: boolean;
  username: string;
}

export type MetadataPathsIndex = Map<string, string[]>;
export type FilePathsIndex = Map<string, string[]>;

/**
 * SourceLocations maintains 2 different indices: `filePathsIndex` and `metadataPathsIndex`.
 *
 * The `filePathsIndex` is a map of metadata keys to the file locations, e.g.
 * ```
 * {
 *    ApexClass__myClass: [~/workspace/my-project/classes/myClass.cls],
 *    CustomObject__myObject__c.myField: [~/workspace/my-project/objects/myObject/fields/myField__c.field-meta.xml]
 * }
 * ```
 * The `metadataPathsIndex` is a map of metadata keys to the meta file locations, e.g.
 * ```
 * {
 *    ApexClass__myClass: [~/workspace/my-project/classes/myClass.cls-meta.xml]
 *    CustomObject__myObject__c: [~/workspace/my-project/objects/myObject/myObject__c.object-meta.xml]
 * }
 * ```
 * The main difference between these two indices is that `filePathsIndex` contains entries for all workspace elements,
 * whereas the `metadataPathsIndex` ONLY contains the entries for the aggregate workspace elements.
 *
 * We allow multiple file paths per metadata key because the same metadata could live in multiple packages, e.g. CustomLabels.
 * When getting a file path based on a given key, we use SfdxProject.getActivePackage() to determine which path to return.
 *
 */
export class SourceLocations extends AsyncCreatable<SourceLocationsOptions> {
  logger!: Logger;

  private static _metadataPathsIndex: MetadataPathsIndex = new Map();
  private static _filePathsIndex: FilePathsIndex = new Map();
  private static _nonDecomposedElementsIndex: NonDecomposedElementsIndex;

  private metadataRegistry: MetadataRegistry;
  private sourcePathInfos: SourcePathInfo[];
  private shouldBuildIndices: boolean;
  private username: string;

  constructor(options: SourceLocationsOptions) {
    super(options);
    this.metadataRegistry = options.metadataRegistry;
    this.sourcePathInfos = options.sourcePathInfos;
    this.shouldBuildIndices = options.shouldBuildIndices;
    this.username = options.username;
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);

    // No need to build indices in some cases, e.g., mdapi:convert and source:convert
    if (this.shouldBuildIndices) {
      await this.buildIndices();
    }
  }

  public getMetadataPath(metadataType: string, fullName: string): Nullable<string> {
    const key = MetadataRegistry.getMetadataKey(metadataType, fullName);
    const paths = SourceLocations.metadataPathsIndex.get(key);
    if (paths) {
      return this.getPathByActivePackage(paths);
    } else {
      this.logger.debug(`No metadata path found for ${key}`);
    }
  }

  public addMetadataPath(metadataType: string, fullName: string, metadataPath: string) {
    const key = MetadataRegistry.getMetadataKey(metadataType, fullName);
    if (SourceLocations.metadataPathsIndex.has(key)) {
      const existing = SourceLocations.metadataPathsIndex.get(key);
      SourceLocations.metadataPathsIndex.set(key, existing.concat(metadataPath));
    } else {
      SourceLocations.metadataPathsIndex.set(key, [metadataPath]);
    }
  }

  public getFilePath(metadataType: string, fullName: string): Nullable<string> {
    const key = MetadataRegistry.getMetadataKey(metadataType, fullName);
    // We search both indices since nondecomposed elements (e.g. CustomLabel) are not
    // included in the filePathsIndex
    let paths = SourceLocations.filePathsIndex.get(key);
    if (!paths && SourceLocations.nonDecomposedElementsIndex) {
      paths = [SourceLocations.nonDecomposedElementsIndex.getMetadataFilePath(key)];
    }
    if (paths) {
      return this.getPathByActivePackage(paths);
    } else {
      this.logger.debug(`No file path found for ${key}`);
    }
  }

  public addFilePath(pathMetadataType: MetadataType, sourcePath: string) {
    const aggregateMetadataType = pathMetadataType.getAggregateMetadataName();
    const fullName = decodeURIComponent(pathMetadataType.getFullNameFromFilePath(sourcePath));
    const key = MetadataRegistry.getMetadataKey(aggregateMetadataType, fullName);
    if (SourceLocations.filePathsIndex.has(key)) {
      const existing = SourceLocations.filePathsIndex.get(key);
      SourceLocations.filePathsIndex.set(key, existing.concat(sourcePath));
    } else {
      SourceLocations.filePathsIndex.set(key, [sourcePath]);
    }
  }

  private getPathByActivePackage(paths: string[]): string {
    if (paths.length === 1) return paths[0];

    const activePackage = SfdxProject.getInstance().getActivePackage();

    const match = paths.find(p => {
      const pkgName = SfdxProject.getInstance().getPackageNameFromPath(p);
      return pkgName === (activePackage && activePackage.name);
    });
    return match || paths[0];
  }

  private async buildIndices() {
    SourceLocations._nonDecomposedElementsIndex = await NonDecomposedElementsIndex.getInstance({
      username: this.username,
      metadataRegistry: this.metadataRegistry
    });

    for (const sourcePathInfo of this.sourcePathInfos) {
      const pathMetadataType = sourcePathInfo.metadataType
        ? MetadataTypeFactory.getMetadataTypeFromMetadataName(sourcePathInfo.metadataType, this.metadataRegistry)
        : null;

      if (pathMetadataType) {
        MetadataTypeCache.sourcePaths.set(sourcePathInfo.sourcePath, pathMetadataType);
        if (sourcePathInfo.isMetadataFile) {
          const aggregateFullName = pathMetadataType.getAggregateFullNameFromFilePath(sourcePathInfo.sourcePath);

          if (this.isInvalidPath(sourcePathInfo.sourcePath)) {
            throw new Error(`Invalid source path for metadataType: ${pathMetadataType}`);
          }

          if (SourceLocations.nonDecomposedElementsIndex.isNonDecomposedElement(sourcePathInfo.metadataType)) {
            await SourceLocations.nonDecomposedElementsIndex.handleDecomposedElements(sourcePathInfo);
          }

          const aggregateMetadataPath = pathMetadataType.getAggregateMetadataFilePathFromWorkspacePath(
            sourcePathInfo.sourcePath
          );
          this.addMetadataPath(pathMetadataType.getMetadataName(), aggregateFullName, aggregateMetadataPath);
          this.addFilePath(pathMetadataType, sourcePathInfo.sourcePath);
        } else if (!sourcePathInfo.isDirectory) {
          this.addFilePath(pathMetadataType, sourcePathInfo.sourcePath);
        }
      }
    }
  }

  private isInvalidPath(sourcePath: string): boolean {
    return isEmpty(sourcePath) || !isString(sourcePath);
  }

  public static get filePathsIndex(): FilePathsIndex {
    return this._filePathsIndex;
  }

  public static set filePathsIndex(newIndex: FilePathsIndex) {
    this._filePathsIndex = newIndex;
  }

  public static get metadataPathsIndex(): MetadataPathsIndex {
    return this._metadataPathsIndex;
  }

  public static set metadataPathsIndex(newIndex: MetadataPathsIndex) {
    this._metadataPathsIndex = newIndex;
  }

  public static get nonDecomposedElementsIndex(): NonDecomposedElementsIndex {
    return this._nonDecomposedElementsIndex;
  }

  public static set nonDecomposedElementsIndex(newIndex: NonDecomposedElementsIndex) {
    this._nonDecomposedElementsIndex = newIndex;
  }
}

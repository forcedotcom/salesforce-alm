/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path = require('path');
import { ForceIgnore } from '@salesforce/source-deploy-retrieve/lib/src/metadata-registry/forceIgnore';

import { ConfigFile, ConfigContents, Logger, fs as fscore, SfdxProject } from '@salesforce/core';
import { isEmpty } from '@salesforce/kit';
import { Dictionary, Nullable } from '@salesforce/ts-types';
import Org = require('../core/scratchOrgApi');
import Messages = require('../messages');
import { SourcePathInfo, SourcePathStatusManager } from './sourcePathStatusManager';
const messages = Messages();

const Package2ConfigFileNames = ['package2-descriptor.json', 'package2-manifest.json'];

type WorkspacePath = string;
type PathInfos = Map<WorkspacePath, SourcePathInfo>;

/**
 * The Workspace class is responsible for traversing the project directory
 * and creating SourcePathInfos for each source path and directory.
 */
export namespace Workspace {
  export interface Options extends ConfigFile.Options {
    org: any;
    forceIgnore: ForceIgnore;
    isStateless: boolean;
  }
}

// eslint-disable-next-line no-redeclare
export class Workspace extends ConfigFile<Workspace.Options> {
  private org: Org;
  private forceIgnore: ForceIgnore;
  private isStateless: boolean;
  private backupPath: string;
  private logger!: Logger;
  public pathInfos: PathInfos = new Map();
  public workspacePath: string;
  public trackedPackages: string[] = [];

  constructor(options: Workspace.Options) {
    super(options);
    this.org = options.org;
    this.forceIgnore = options.forceIgnore;
    this.isStateless = options.isStateless;
    this.workspacePath = options.org.config.getProjectPath();
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.options.filePath = path.join('orgs', this.org.name);
    this.options.filename = Workspace.getFileName();
    await super.init();

    this.backupPath = `${this.getPath()}.bak`;

    if (!this.isStateless) {
      await this.initializeCached();
      const pathInfos = this.getContents();
      if (isEmpty(pathInfos)) {
        await this.initializeStateFull();
      }
    } else {
      this.initializeStateless();
    }
  }

  private async initializeCached() {
    this.logger.debug('Reading workspace from cache');
    let workspacePathChanged: boolean;
    const trackedPackages = [];
    try {
      const oldSourcePathInfos = [...this.values()];

      let oldWorkspacePath: string;
      for (const sourcePathInfoObj of oldSourcePathInfos) {
        if (!sourcePathInfoObj.package) {
          const packagePath = SfdxProject.getInstance().getPackageNameFromPath(sourcePathInfoObj.sourcePath);
          if (packagePath) {
            sourcePathInfoObj.package = packagePath;
          }
        }
        if (sourcePathInfoObj.isWorkspace) {
          oldWorkspacePath = sourcePathInfoObj.sourcePath;
        }
        if (sourcePathInfoObj.isArtifactRoot) {
          trackedPackages.push(sourcePathInfoObj.sourcePath);
        }
      }
      this.trackedPackages = trackedPackages;
      workspacePathChanged = !!oldWorkspacePath && this.workspacePath !== oldWorkspacePath;
      for (const sourcePathInfoObj of oldSourcePathInfos) {
        const sourcePathInfo = await SourcePathInfo.create(sourcePathInfoObj);

        if (workspacePathChanged) {
          const oldPath = sourcePathInfo.sourcePath;
          sourcePathInfo.sourcePath = path.join(
            this.workspacePath,
            path.relative(oldWorkspacePath, sourcePathInfo.sourcePath)
          );
          this.unset(oldPath);
        }
        this.set(sourcePathInfo.sourcePath, sourcePathInfo);
      }
    } catch (e) {
      // Do nothing if the file can't be read, which will cause the workspace to be initialized
    }

    if (workspacePathChanged) {
      await this.write();
    }
  }

  private async initializeStateFull() {
    this.logger.debug('Initializing statefull workspace');
    const packages = SfdxProject.getInstance()
      .getUniquePackageDirectories()
      .map((p) => stripTrailingSlash(p.fullPath));
    this.trackedPackages = packages;
    await this.walkDirectories(packages);
    await this.write();
  }

  private initializeStateless() {
    this.logger.debug('Initializing stateless workspace');
    this.trackedPackages = SfdxProject.getInstance()
      .getUniquePackageDirectories()
      .map((p) => stripTrailingSlash(p.fullPath));
    this.setContents({});
  }

  public getContents(): Dictionary<SourcePathInfo.Json> {
    return this['contents'] as Dictionary<SourcePathInfo.Json>;
  }

  public entries(): Array<[string, SourcePathInfo.Json]> {
    // override entries and cast here to avoid casting every entries() call
    return super.entries() as Array<[string, SourcePathInfo.Json]>;
  }

  public static getFileName(): string {
    return 'sourcePathInfos.json';
  }

  public async rewriteInfos() {
    await this.initializeStateFull();
  }

  public async walkDirectories(directories: string[]) {
    for (const directory of directories) {
      const exists = await fscore.fileExists(directory);
      if (!exists) {
        const error = new Error(messages.getMessage('InvalidPackageDirectory', directory));
        error['name'] = 'InvalidProjectWorkspace';
        throw error;
      }
      await this.walk(directory);
    }
  }

  /**
   * Walks the directory using native fs.readdir
   */
  public async walk(directory: string, recur?: boolean): Promise<void> {
    if (!recur) {
      await this.handleArtifact(directory, directory);
    }
    const files = await fscore.readdir(directory);
    for (const filename of files) {
      const sourcePath = path.join(directory, filename);
      const sourcePathInfo = await this.handleArtifact(sourcePath, directory);
      if (sourcePathInfo.isDirectory) {
        await this.walk(sourcePath, true);
      }
    }
  }

  public async handleArtifact(sourcePath: string, parentDirectory?: string): Promise<SourcePathInfo> {
    const isWorkspace = false;
    const isArtifactRoot = parentDirectory ? sourcePath === parentDirectory : false;
    const sourcePathInfo = await SourcePathInfo.create({
      sourcePath,
      deferContentHash: false,
      isWorkspace,
      isArtifactRoot,
    });
    if (this.isValidSourcePath(sourcePathInfo)) {
      this.set(sourcePath, sourcePathInfo);
    }
    return sourcePathInfo;
  }

  /**
   * Check if the given sourcePath should be ignored
   */
  public isValidSourcePath(sourcePathInfo: SourcePathInfo): boolean {
    const sourcePath = sourcePathInfo.sourcePath;

    let isValid = this.forceIgnore.accepts(sourcePath);

    const basename = path.basename(sourcePath);

    const isPackage2ConfigFile = Package2ConfigFileNames.includes(basename);

    isValid = !basename.startsWith('.') && !basename.endsWith('.dup') && isValid && !isPackage2ConfigFile;

    if (isValid && !!SourcePathStatusManager.metadataRegistry) {
      if (!sourcePathInfo.isDirectory) {
        if (!SourcePathStatusManager.metadataRegistry.isValidSourceFilePath(sourcePath)) {
          const error = new Error(`Unexpected file found in package directory: ${sourcePath}`);
          error['name'] = 'UnexpectedFileFound';
          throw error;
        }
      }
    }

    // Skip directories/files beginning with '.', end with .dup, and that should be ignored
    return isValid;
  }

  public async write() {
    if (!this.has(this.workspacePath)) {
      const workspaceSourcePathInfo = await SourcePathInfo.create({
        sourcePath: this.workspacePath,
        deferContentHash: false,
        isWorkspace: true,
        isArtifactRoot: false,
      });
      this.set(this.workspacePath, workspaceSourcePathInfo);
    }
    return super.write();
  }

  public get(key: string): Nullable<SourcePathInfo.Json> {
    return this.getContents()[key];
  }

  public async getInitializedValue(key: string): Promise<SourcePathInfo> {
    const value = this.get(key);
    return SourcePathInfo.create(value);
  }

  public has(key: string): boolean {
    return !!this.get(key);
  }

  public values(): SourcePathInfo.Json[] {
    return super.values() as SourcePathInfo.Json[];
  }

  public async getInitializedValues(): Promise<SourcePathInfo[]> {
    const values = this.values();
    const initialized: SourcePathInfo[] = [];
    for (const value of values) {
      initialized.push(await SourcePathInfo.create(value));
    }
    return initialized;
  }

  // @ts-ignore because typescript expects value to be a SourcePathInfo.Json but we want to do the
  // conversion from a SourcePathInfo instance to SourcePathInfo.Json here instead of relying on whoever
  // calls this method to do it first.
  public set(key: string, value: SourcePathInfo) {
    return super.set(key, value.toJson());
  }

  protected setMethod(contents: Dictionary<SourcePathInfo.Json>, key: string, value: SourcePathInfo.Json) {
    contents[key] = value;
  }

  public async revert() {
    if (await fscore.fileExists(this.backupPath)) {
      const backedupContents = await fscore.readFile(this.backupPath, 'UTF-8');
      this.setContentsFromObject(JSON.parse(backedupContents));
      await this.write();
      await fscore.unlink(this.backupPath);
    }
  }

  public async backup() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (this.exists()) {
      await fscore.writeFile(this.backupPath, JSON.stringify(this.getContents()));
    }
  }

  public async read() {
    try {
      return await super.read();
    } catch (err) {
      if (err.name === 'JsonDataFormatError') {
        // This error means that the old sourcePathInfos format is still
        // in use and so we need to convert it to the new format.
        const contents = await fscore.readFile(this.getPath(), 'utf-8');
        const map = new Map(JSON.parse(contents));
        const obj: ConfigContents = {};
        map.forEach((value: SourcePathInfo.Json, key: string) => (obj[key] = value));
        this.setContentsFromObject(obj);
        await this.write();
        return this.getContents();
      }
    }
  }
}

function stripTrailingSlash(str: string): string {
  return str.endsWith(path.sep) ? str.slice(0, -1) : str;
}

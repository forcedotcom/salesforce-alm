/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ForceIgnore } from './forceIgnore';

import { ConfigFile, ConfigContents, Logger, fs as fscore } from '@salesforce/core';
import { isEmpty } from '@salesforce/kit';
import { SourcePathInfo, SourcePathStatusManager } from './sourcePathStatusManager';
import { PackageInfoCache } from './packageInfoCache';
import path = require('path');
import { AnyJson, Dictionary } from '@salesforce/ts-types';
import Org = require('../core/scratchOrgApi');
import Messages = require('../messages');
const messages = Messages();

const Package2ConfigFileNames = ['package2-descriptor.json', 'package2-manifest.json'];

type WorkspacePath = string;
type PathInfos = Map<WorkspacePath, SourcePathInfo>;

// TODO refactor sourceState to the following or remove sourceState in favor of this enum and type.

export enum WorkspaceFileState {
  UNCHANGED = 'u',
  CHANGED = 'c',
  DELETED = 'd',
  NEW = 'n',
  DUP = 'p'
}

export type WorkspaceFile = {
  sourcePath: string;
  deferContentHash: boolean;
  isWorkspace: boolean;
  isArtifactRoot: boolean;
  state: WorkspaceFileState;
  package: string;
  isDirectory: boolean;
  isMetadataFile: boolean;
  size: number;
  modifiedTime: number;
  changeTime: number;
  contentHash: string;
};

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

export class Workspace extends ConfigFile<Workspace.Options> {
  private org: Org;
  private forceIgnore: ForceIgnore;
  private isStateless: boolean;
  private backupPath: string;
  private logger!: Logger;
  public pathInfos: PathInfos = new Map();
  public workspacePath: string;
  public packageInfoCache: PackageInfoCache;
  public trackedPackages: string[] = [];

  constructor(options: Workspace.Options) {
    super(options);
    this.org = options.org;
    this.forceIgnore = options.forceIgnore;
    this.isStateless = options.isStateless;
    this.workspacePath = options.org.config.getProjectPath();
    this.packageInfoCache = PackageInfoCache.getInstance();
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.options.filePath = path.join('.sfdx', 'orgs', this.org.name);
    this.options.filename = this.getFileName();
    await super.init();

    this.backupPath = `${this.getPath()}.bak`;

    if (!this.isStateless) {
      await this.initializeCached();
      const pathInfos = this.getContents();
      if (isEmpty(pathInfos)) {
        await this.initializeStateFull();
      }
    } else {
      await this.initializeStateless();
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
          sourcePathInfoObj.package = this.packageInfoCache.getPackageNameFromSourcePath(sourcePathInfoObj.sourcePath);
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
    const packages = this.packageInfoCache.packagePaths.map(p => stripTrailingSlash(p));
    this.trackedPackages = packages;
    await this.walkDirectories(packages);
    await this.write();
  }

  private async initializeStateless() {
    this.logger.debug('Initializing stateless workspace');
    this.trackedPackages = this.packageInfoCache.packagePaths.map(p => stripTrailingSlash(p));
    this.setContents({});
  }

  public getContents(): Dictionary<WorkspaceFile> {
    // override getContents and cast here to avoid casting every getContents() call
    return this['contents'] as Dictionary<WorkspaceFile>;
  }

  public entries(): [string, WorkspaceFile][] {
    // override entries and cast here to avoid casting every entries() call
    return super.entries() as [string, WorkspaceFile][];
  }

  public getFileName(): string {
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
    for (let filename of files) {
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
    const sourcePathInfo = await this.createSourcePathInfoFromPath(sourcePath, isWorkspace, isArtifactRoot);
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

  /**
   * Create a new SourcePathInfo from the given sourcePath
   */
  private async createSourcePathInfoFromPath(
    sourcePath: string,
    isWorkspace: boolean,
    isArtifactRoot: boolean
  ): Promise<SourcePathInfo> {
    return SourcePathInfo.create({
      sourcePath,
      deferContentHash: false,
      isWorkspace,
      isArtifactRoot
    });
  }

  public async write() {
    if (!this.has(this.workspacePath)) {
      const workspaceSourcePathInfo = await this.createSourcePathInfoFromPath(this.workspacePath, true, false);
      this.set(this.workspacePath, workspaceSourcePathInfo);
    }
    return super.write();
  }

  // @ts-ignore
  public get(key: string): SourcePathInfo {
    return (this.getContents()[key] as unknown) as SourcePathInfo;
  }

  public has(key: string): boolean {
    return !!this.get(key);
  }

  // @ts-ignore
  public values(): SourcePathInfo[] {
    return (super.values() as unknown) as SourcePathInfo[];
  }

  // @ts-ignore
  public set(key: string, value: SourcePathInfo) {
    return super.set(key, (value as unknown) as AnyJson);
  }

  protected setMethod(contents: AnyJson, key: string, value: AnyJson) {
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
        map.forEach((value: AnyJson, key: string) => (obj[key] = value));
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

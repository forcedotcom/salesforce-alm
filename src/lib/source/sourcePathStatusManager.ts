/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { fs as fscore, Logger, SfdxProject } from '@salesforce/core';

import { ForceIgnore } from '@salesforce/source-deploy-retrieve/lib/src/metadata-registry/forceIgnore';
import { JsonMap, Nullable } from '@salesforce/ts-types';
import srcDevUtil = require('../core/srcDevUtil');
import Messages = require('../messages');
import { WorkspaceFileState, toReadableState, ReadableFileState } from './workspaceFileState';
import MetadataRegistry = require('./metadataRegistry');
const messages = Messages();

import { AsyncCreatable } from '@salesforce/kit';
import { Workspace } from './workspace';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { Stats } from 'fs';

type Filter = {
  changesOnly?: boolean;
  packageDirectory?: string;
  sourcePath?: string;
};

type PartiallyRequired<T, U extends keyof T> = Required<Pick<T, U>> & Partial<Omit<T, U>>;

export namespace SourcePathInfo {
  // We only require sourcePath because that's the bare minimum required to instaniate a SourcePathInfo.
  export type BaseEntry = PartiallyRequired<Entry, 'sourcePath'>;

  export interface Entry {
    changeTime: number;
    contentHash: string;
    deferContentHash: boolean;
    isArtifactRoot: boolean;
    isDirectory: boolean;
    isMetadataFile: boolean;
    isWorkspace: boolean;
    metadataType: string;
    modifiedTime: number;
    package: string;
    size: number;
    sourcePath: string;
    state: WorkspaceFileState;
  }

  export type Json = Entry & JsonMap;
}

// eslint-disable-next-line no-redeclare
export class SourcePathInfo extends AsyncCreatable<SourcePathInfo.BaseEntry> implements SourcePathInfo.Entry {
  public changeTime: number;
  public contentHash: string;
  public deferContentHash = false;
  public isArtifactRoot: boolean;
  public isDirectory: boolean;
  public isMetadataFile: boolean;
  public isWorkspace: boolean;
  public metadataType: string;
  public modifiedTime: number;
  public package: string;
  public size: number;
  public sourcePath: string;
  public state: WorkspaceFileState;

  constructor(options: SourcePathInfo.BaseEntry) {
    super(options);
    Object.assign(this, options);
  }

  protected async init(): Promise<void> {
    // if modifiedTime and state already exist, we assume that there's no need to reprocess
    // the sourcePathInfo and that the other properties already exist. Technically, not
    // a safe assumption... but it seems to work out
    if (!this.modifiedTime || !this.state) {
      await this.initFromPath(this.sourcePath, this.deferContentHash);
    }
  }

  /**
   * Return a clone of this SourcePathInfo, overriding specified properties.
   *
   * @param overrides SourcePathInfo properties that should override the cloned properties
   */
  public async clone(overrides: Partial<SourcePathInfo.Entry> = {}): Promise<SourcePathInfo> {
    const entry = Object.assign({}, this.toJson(), overrides);
    return SourcePathInfo.create(entry);
  }

  /**
   * Initialize path info based on a path in the workspace
   */
  public async initFromPath(sourcePath: string, deferContentHash?: boolean) {
    // If we are initializing from path then the path is new
    this.state = WorkspaceFileState.NEW;
    this.sourcePath = sourcePath;

    const packageDir = SfdxProject.getInstance().getPackageNameFromPath(sourcePath);
    if (packageDir) {
      this.package = packageDir;
    }

    let filestat: Stats;
    try {
      filestat = await fscore.stat(sourcePath);
    } catch (e) {
      // If there is an error with filestat then the path is deleted
      this.state = WorkspaceFileState.DELETED;
      return;
    }
    this.isDirectory = filestat.isDirectory();
    this.isMetadataFile = !this.isDirectory && this.sourcePath.endsWith(MetadataRegistry.getMetadataFileExt());

    if (!this.metadataType && !this.isDirectory) {
      const metadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(
        sourcePath,
        SourcePathStatusManager.metadataRegistry
      );
      if (metadataType) {
        this.metadataType = metadataType.getMetadataName();
      }
    }

    this.size = filestat.size;
    this.modifiedTime = filestat.mtime.getTime();
    this.changeTime = filestat.ctime.getTime();
    if (!deferContentHash) {
      await this.computeContentHash();
    }
  }

  public async computeContentHash() {
    const contents = this.isDirectory
      ? (await fscore.readdir(this.sourcePath)).toString()
      : await fscore.readFile(this.sourcePath);
    this.contentHash = srcDevUtil.getContentHash(contents);
  }

  /**
   * If the source has been modified, return the path info for the change
   */
  public async getPendingPathInfo(): Promise<Nullable<SourcePathInfo>> {
    const pendingPathInfo = await SourcePathInfo.create({
      sourcePath: this.sourcePath,
      metadataType: this.metadataType,
      isWorkspace: this.isWorkspace,
      package: this.package,
      deferContentHash: true, // Defer computing content hash until we know we need to check it
    });

    // See if the referenced path has been deleted
    if (pendingPathInfo.isDeleted()) {
      // Force setting isDirectory and isMetadataFile for deleted paths
      pendingPathInfo.isDirectory = this.isDirectory;
      pendingPathInfo.isMetadataFile = this.isMetadataFile;
      pendingPathInfo.size = this.size;
      return pendingPathInfo;
    }
    // Unless deleted, new paths always return true. no need for further checks
    if (this.state === WorkspaceFileState.NEW) {
      return this;
    }
    // Next we'll check if the path infos are different
    if (
      pendingPathInfo.isDirectory || // Always need to compare the hash on directories
      pendingPathInfo.size !== this.size ||
      pendingPathInfo.modifiedTime !== this.modifiedTime ||
      pendingPathInfo.changeTime !== this.changeTime
    ) {
      // Now we will compare the content hashes
      await pendingPathInfo.computeContentHash();
      if (pendingPathInfo.contentHash !== this.contentHash) {
        pendingPathInfo.state = WorkspaceFileState.CHANGED;
        return pendingPathInfo;
      } else {
        // The hashes are the same, so the file hasn't really changed. Update our info.
        //   These will automatically get saved when other pending changes are committed
        this.size = pendingPathInfo.size;
        this.modifiedTime = pendingPathInfo.modifiedTime;
        this.changeTime = pendingPathInfo.changeTime;
      }
    }
    return null;
  }

  public isDeleted(): boolean {
    return this.state === WorkspaceFileState.DELETED;
  }

  public isNew(): boolean {
    return this.state === WorkspaceFileState.NEW;
  }

  public isChanged(): boolean {
    return this.state === WorkspaceFileState.CHANGED;
  }

  public getState(): ReadableFileState {
    return toReadableState(this.state);
  }

  public toJson(): SourcePathInfo.Json {
    const entry: SourcePathInfo.Json = {
      sourcePath: this.sourcePath,
      isDirectory: this.isDirectory,
      size: this.size,
      modifiedTime: this.modifiedTime,
      changeTime: this.changeTime,
      contentHash: this.contentHash,
      isMetadataFile: this.isMetadataFile,
      state: this.state,
      isWorkspace: this.isWorkspace,
      isArtifactRoot: this.isArtifactRoot,
      package: this.package,
      metadataType: this.metadataType,
      deferContentHash: this.deferContentHash,
    };
    // remove all properites with a null value
    return Object.keys(entry)
      .filter((k) => !!entry[k])
      .reduce((a, k) => ({ ...a, [k]: entry[k] }), {} as SourcePathInfo.Json);
  }
}

namespace SourcePathStatusManager {
  export type Options = {
    org: any;
    isStateless?: boolean;
  };
}

/**
 * Manages a data model for tracking changes to local workspace paths
 */
// eslint-disable-next-line no-redeclare
export class SourcePathStatusManager extends AsyncCreatable<SourcePathStatusManager.Options> {
  public logger!: Logger;
  public fileMoveLogger!: Logger;
  public org: any;
  public isStateless = false;
  public workspacePath: string;
  public forceIgnore: ForceIgnore;
  public workspace: Workspace;

  public static metadataRegistry: MetadataRegistry;

  constructor(options: SourcePathStatusManager.Options) {
    super(options);
    this.org = options.org;
    this.isStateless = options.isStateless || false;
    this.workspacePath = options.org.config.getProjectPath();
    this.forceIgnore = ForceIgnore.findAndCreate(SfdxProject.resolveProjectPathSync());
    SourcePathStatusManager.metadataRegistry = new MetadataRegistry();
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    // A logger just for file moves.  Users can enable this debug output to see
    // an acknowledgement of their move operations.
    this.fileMoveLogger = await Logger.child('FileMoves');
    const workspaceOpts = {
      org: this.org,
      forceIgnore: this.forceIgnore,
      isStateless: this.isStateless,
    };
    this.workspace = await Workspace.create(workspaceOpts);
  }

  /**
   * Get path infos for the source workspace, applying any filters specified.
   */
  public async getSourcePathInfos(filter: Filter = {}): Promise<SourcePathInfo[]> {
    // normalize packageDirectory (if defined) to end with a path separator
    filter.packageDirectory = normalizeDirectoryPath(filter.packageDirectory);

    const trackedPackages = this.workspace.trackedPackages.map((p) => normalizeDirectoryPath(p));
    const allPackages = SfdxProject.getInstance()
      .getUniquePackageDirectories()
      .map((p) => normalizeDirectoryPath(p.fullPath));
    const untrackedPackages = allPackages.filter((rootDir) => !trackedPackages.includes(rootDir));

    // if a root directory is specified, make sure it is a project source directory
    if (rootDirectoryIsNotASourceDirectory(filter.packageDirectory, allPackages)) {
      throw new Error(messages.getMessage('rootDirectoryNotASourceDirectory', [], 'sourceConvertCommand'));
    }

    // If a sourcePath was passed in and we are in stateless mode (e.g., changesets)
    // add only the specified source path to workspacePathInfos.
    if (this.isStateless && filter.sourcePath) {
      await this.workspace.handleArtifact(filter.sourcePath);
    } else {
      if (untrackedPackages.length > 0) {
        await this.workspace.walkDirectories(untrackedPackages);
      }
    }

    // This is a shallow copy of the content in sourcePathInfos.json,
    // or walking the file system to build that file.
    const sourcePathInfos = await this.workspace.getInitializedValues();
    const processedSourcePathInfos = new Map<string, SourcePathInfo>();

    // Keep track of adds and deletes to detect moves
    const addedSourcePathInfos: SourcePathInfo[] = [];
    const deletedSourcePathInfos: SourcePathInfo[] = [];

    for (const sourcePathInfo of sourcePathInfos) {
      const shouldIncludeSourcePathInfo = this.shouldIncludeSourcePathInfo(sourcePathInfo, filter);

      // If this is null, that means that the source has NOT changed
      const pendingSourcePathInfo = await sourcePathInfo.getPendingPathInfo();

      if (!pendingSourcePathInfo) {
        if (!filter.changesOnly && shouldIncludeSourcePathInfo) {
          // If the source has NOT changed but we're NOT filtering on changesOnly, then add it
          processedSourcePathInfos.set(sourcePathInfo.sourcePath, sourcePathInfo);
        }
      } else {
        if (shouldIncludeSourcePathInfo) {
          // The source has changed so add it
          if (
            pendingSourcePathInfo.isDirectory &&
            !pendingSourcePathInfo.isDeleted() &&
            !pendingSourcePathInfo.isWorkspace
          ) {
            // If it's a directory and it isn't deleted then process the directory change.
            // This is how new files are added.
            const processed = await this.processChangedDirectory(pendingSourcePathInfo.sourcePath);
            for (const spi of processed) {
              if (spi) {
                processedSourcePathInfos.set(spi.sourcePath, spi);
                // Keep track of added files to check if they are moves
                if (spi.state === WorkspaceFileState.NEW) {
                  addedSourcePathInfos.push(spi);
                }
              }
            }
          }
          processedSourcePathInfos.set(pendingSourcePathInfo.sourcePath, pendingSourcePathInfo);

          // Keep track of deleted files to check if they are moves
          if (pendingSourcePathInfo.state === WorkspaceFileState.DELETED) {
            deletedSourcePathInfos.push(pendingSourcePathInfo);
          }
        }
      }
    }

    const finalSourcePathInfos = await this.processFileMoves(
      addedSourcePathInfos,
      deletedSourcePathInfos,
      processedSourcePathInfos
    );
    this.logger.debug(`Found ${finalSourcePathInfos.length} sourcePathInfos`);
    finalSourcePathInfos.forEach((key) => this.logger.debug(key));
    return finalSourcePathInfos;
  }

  /**
   * Determine if the provided sourcePathInfo should be processed during a source action (deploy, retrieve, push, pull, convert)
   * A sourcePathInfo is INCLUDED if any of the following crietria are met:
   * 1. If the sourcePathInfo.sourcePath is nested under the package directory
   * 2. If the sourcePathInfo.sourcePath is the same or is nested under filter.sourcePath
   * 3. If the sourcePathInfo.sourcePath is NOT ignored in the .forceignore file
   */
  public shouldIncludeSourcePathInfo(sourcePathInfo: SourcePathInfo, filter: Filter = {}): boolean {
    const { packageDirectory, sourcePath } = filter;
    // default to including this sourcePathInfo
    let shouldIncludeSourcePathInfo = true;

    if (packageDirectory) {
      shouldIncludeSourcePathInfo = sourcePathInfo.sourcePath.includes(packageDirectory);
    }

    if (shouldIncludeSourcePathInfo && sourcePath) {
      shouldIncludeSourcePathInfo = sourcePathInfo.sourcePath.includes(sourcePath);
    }

    if (this.forceIgnore.denies(sourcePathInfo.sourcePath)) {
      shouldIncludeSourcePathInfo = false;
    }
    return shouldIncludeSourcePathInfo;
  }

  // Detects SourcePathInfo moves by looking for matching partial file
  // paths of an add and a delete, then updates sourcePathInfos.json.
  private async processFileMoves(
    addedSourcePathInfos: SourcePathInfo[],
    deletedSourcePathInfos: SourcePathInfo[],
    processedSourcePathInfos: Map<string, SourcePathInfo>
  ): Promise<SourcePathInfo[]> {
    // Only do move detection if there were both added and deleted files.
    if (addedSourcePathInfos.length && deletedSourcePathInfos.length) {
      this.logger.debug(
        `There were ${addedSourcePathInfos.length} adds and ${deletedSourcePathInfos.length} deletes. Checking if these are moves.`
      );

      // The SourcePathInfo updates to commit to sourcePathInfos.json
      const spiUpdates: SourcePathInfo[] = [];

      let deletedSpi: SourcePathInfo;

      // Iterate over all deleted SourcePathInfos and compare to added SourcePathInfos
      while ((deletedSpi = deletedSourcePathInfos.pop())) {
        const fullPath = deletedSpi.sourcePath;
        const packagePath = SfdxProject.getInstance().getPackagePath(deletedSpi.package);
        const pathAfterPackageDir = fullPath.replace(packagePath, '');

        this.logger.debug(`Looking for ${pathAfterPackageDir} in list of added files`);
        const matchingAddedSpi = addedSourcePathInfos.find((addedSpi) => {
          let found = false;
          if (addedSpi.sourcePath.endsWith(pathAfterPackageDir)) {
            // it was moved to another package.
            found = true;
          } else {
            const pathWithinPackage = pathAfterPackageDir.split(path.sep).slice(2).join(path.sep);
            if (addedSpi.sourcePath.endsWith(pathWithinPackage)) {
              // it was moved within the package (within 2 directories of the package dir)
              found = true;
            }
          }
          if (found) {
            this.logger.debug(`${fullPath} was moved to ${addedSpi.sourcePath}`);
            this.fileMoveLogger.info(`${fullPath} was moved to ${addedSpi.sourcePath}`);
          }
          return found;
        });

        if (matchingAddedSpi) {
          // Now find out if the file was changed AND moved by comparing sizes.
          // NOTE: this is not perfect but should be correct 99.9% of the time.
          if (matchingAddedSpi.size !== deletedSpi.size) {
            this.logger.debug(`${matchingAddedSpi.sourcePath} was moved and changed`);

            // We have to create a different SourcePathInfo instance to use for commit
            // in this case because we want to commit the add with some of the data from
            // the deleted file but track the changed file state.
            const movedSpiBeforeChanges = await matchingAddedSpi.clone({
              size: deletedSpi.size,
              state: WorkspaceFileState.CHANGED,
              contentHash: deletedSpi.contentHash,
            });
            spiUpdates.push(movedSpiBeforeChanges);
          } else {
            spiUpdates.push(matchingAddedSpi);
          }

          processedSourcePathInfos.set(matchingAddedSpi.sourcePath, matchingAddedSpi);
          processedSourcePathInfos.delete(deletedSpi.sourcePath);
          spiUpdates.push(deletedSpi);
        }
      }

      if (spiUpdates.length) {
        // Grab the directories for these changes too for the updated directory hashes.
        spiUpdates.forEach((spi) => {
          const dirSpi = processedSourcePathInfos.get(path.dirname(spi.sourcePath));
          dirSpi && spiUpdates.push(dirSpi);
        });
        this.commitChangedPathInfos(spiUpdates);
      }
    }

    return [...processedSourcePathInfos.values()];
  }

  /**
   * Update the data model with changes
   */
  public async commitChangedPathInfos(sourcePathInfos: SourcePathInfo[]): Promise<void> {
    for (const sourcePathInfo of sourcePathInfos) {
      if (sourcePathInfo.state !== WorkspaceFileState.UNCHANGED) {
        if (sourcePathInfo.isDeleted()) {
          this.workspace.unset(sourcePathInfo.sourcePath);
        } else {
          sourcePathInfo.state = WorkspaceFileState.UNCHANGED;
          this.workspace.set(sourcePathInfo.sourcePath, sourcePathInfo);
        }
      }
    }
    await this.workspace.write();
  }

  /**
   * Update data model for the given paths
   */
  public async updateInfosForPaths(updatedPaths: string[], deletedPaths: string[]): Promise<void> {
    // check if the parent paths of updated paths need to be added to workspacePathInfos too
    for (const updatedPath of updatedPaths.slice()) {
      if (!this.workspace.has(updatedPath)) {
        const sourcePath = updatedPath.split(path.sep);
        while (sourcePath.length > 1) {
          sourcePath.pop();
          const parentPath = sourcePath.join(path.sep);
          updatedPaths.push(parentPath);
          if (this.workspace.has(parentPath)) {
            break;
          }
        }
      }
    }

    for (const deletedPath of deletedPaths) {
      this.workspace.unset(deletedPath);
    }

    const promises = updatedPaths.map(async (updatedPath) => {
      let sourcePathInfo: SourcePathInfo;
      const existing = this.workspace.get(updatedPath);
      if (existing) {
        // If a sourcePathInfo exists for the updatedPath, we still want to create a new sourcePathInfo
        // but we need to preserve the isWorkspace and isArtifact properties
        sourcePathInfo = await SourcePathInfo.create({
          sourcePath: updatedPath,
          isWorkspace: existing.isWorkspace,
          isArtifactRoot: existing.isArtifactRoot,
        });
      } else {
        sourcePathInfo = await SourcePathInfo.create({ sourcePath: updatedPath });
      }
      sourcePathInfo.state = WorkspaceFileState.UNCHANGED;
      this.workspace.set(updatedPath, sourcePathInfo);
    });

    await Promise.all(promises);

    await this.workspace.write();
  }

  public async backup() {
    await this.workspace.backup();
  }

  public async revert() {
    await this.workspace.revert();
  }

  /**
   * Get the path infos for source that has been updated in the given directory
   */
  private async processChangedDirectory(directoryPath: string): Promise<SourcePathInfo[]> {
    // If the path is a directory and wasn't deleted then we want to process the contents for changes
    const files = await fscore.readdir(directoryPath);
    const updatedPathInfos = [];
    for (const file of files) {
      const fullPath = path.join(directoryPath, file);
      // We only need to process additions to the directory, any existing ones will get dealt with on their own
      if (this.workspace.has(fullPath)) {
        continue;
      }
      const pathInfos = await this.getNewPathInfos(fullPath);
      updatedPathInfos.push(...pathInfos);
    }

    return updatedPathInfos;
  }

  /**
   * Get the path infos for newly added source
   */
  private async getNewPathInfos(sourcePath: string): Promise<SourcePathInfo[]> {
    let newPathInfos = [];
    const newPathInfo = await SourcePathInfo.create({
      sourcePath,
      deferContentHash: false,
    });

    if (this.workspace.isValidSourcePath(newPathInfo)) {
      newPathInfos.push(newPathInfo);
      if (newPathInfo.isDirectory) {
        const files = await fscore.readdir(sourcePath);
        const promises = files.map(async (file) => await this.getNewPathInfos(path.join(sourcePath, file)));
        const infos = await Promise.all(promises);
        newPathInfos = newPathInfos.concat(infos.reduce((x, y) => x.concat(y), []));
      }
    }
    return newPathInfos;
  }
}

/**
 * Ensure that the directory path ends with a path separator
 */
function normalizeDirectoryPath(dirPath: string): string {
  return dirPath && !dirPath.endsWith(path.sep) ? `${dirPath}${path.sep}` : dirPath;
}

/**
 * Determine if the provided directroy path has source files
 */
function rootDirectoryIsNotASourceDirectory(packageDirPath: string, trackedPackages: string[]): boolean {
  return !!packageDirPath && !trackedPackages.find((pkg) => packageDirPath.startsWith(pkg));
}

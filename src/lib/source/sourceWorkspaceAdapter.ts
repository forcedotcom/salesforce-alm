/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
import * as path from 'path';

import * as sourceState from './sourceState';
import { AggregateSourceElement } from './aggregateSourceElement';
import { WorkspaceElement } from './workspaceElement';
import { MetadataTypeFactory, FileProperty } from './metadataTypeFactory';
import { AsyncCreatable, env, isEmpty } from '@salesforce/kit';
import { isString } from '@salesforce/ts-types';
import { Logger, LoggerLevel, SfdxError } from '@salesforce/core';
import { SourcePathStatusManager, SourcePathInfo } from './sourcePathStatusManager';
import chalk = require('chalk');
import { PackageInfoCache } from './packageInfoCache';
import { AggregateSourceElements } from './aggregateSourceElements';
import { SourceLocations } from './sourceLocations';
import MetadataRegistry = require('./metadataRegistry');

/**
 * private helper to log when a metadata type isn't supported
 * @param {string} metadataName - the metadata type name
 * @param {string} filePath - the filepath to the metadata item
 * @private
 */
const _logUnsupported = function(metadataName, filePath) {
  if (!util.isNullOrUndefined(filePath)) {
    this.logger.warn(`Unsupported source member ${metadataName} at ${filePath}`);
  } else {
    this.logger.warn(`Unsupported source member ${metadataName}`);
  }
};

export class SourceWorkspaceAdapter extends AsyncCreatable<SourceWorkspaceAdapter.Options> {
  public logger!: Logger;
  public wsPath: string;
  public defaultPackagePath: string;
  public isStateless: boolean;
  public spsm: any;
  public metadataRegistry: MetadataRegistry;
  public sourceLocations: any;
  public namespace: string;
  public defaultSrcDir: string;
  public fromConvert: boolean;
  public forceIgnore: any;
  public pendingSourcePathInfos: PendingSourcePathInfos;
  public pendingDirectories: any[];
  public changedSourceElementsCache = new AggregateSourceElements();
  public allAggregateSourceElementsCache = new AggregateSourceElements();
  public options: SourceWorkspaceAdapter.Options;
  public packageInfoCache: PackageInfoCache;

  /**
   * @ignore
   */
  public constructor(options: SourceWorkspaceAdapter.Options) {
    super(options);
    this.options = options;

    this.wsPath = options.org.config.getProjectPath();
    if (isEmpty(this.wsPath) || !isString(this.wsPath)) {
      throw SfdxError.create('salesforce-alm', 'source_workspace_adapter', 'missing_workspace');
    }

    // There appears to be difference between the parameter defaultPackagePath and the member instance defaultPackagePath
    // It's reflected in the unit tests mdapiConvertApiTest.
    // Since we are not doing strict null checking this runtime check is required for path.join.
    if (isEmpty(options.defaultPackagePath) || !isString(options.defaultPackagePath)) {
      throw SfdxError.create('salesforce-alm', 'source_workspace_adapter', 'missing_package_path');
    }

    this.isStateless = options.sourceMode === SourceWorkspaceAdapter.modes.STATELESS;
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.packageInfoCache = PackageInfoCache.getInstance();
    this.spsm = await SourcePathStatusManager.create({
      org: this.options.org,
      isStateless: this.isStateless
    });

    this.metadataRegistry = new this.options.metadataRegistryImpl(this.options.org);
    this.fromConvert = this.options.fromConvert || false;
    this.sourceLocations = await SourceLocations.create({
      metadataRegistry: this.metadataRegistry,
      sourcePathInfos: await this.spsm.getSourcePathInfos(),
      shouldBuildIndices: !this.fromConvert,
      username: this.options.org.name
    });
    this.wsPath = this.options.org.config.getProjectPath();
    this.namespace = this.options.org.config.getAppConfig().namespace;
    this.defaultSrcDir = path.join(this.wsPath, this.options.defaultPackagePath, 'main', 'default');
    this.forceIgnore = this.spsm.forceIgnore;
    this.defaultPackagePath = this.options.org.config.getAppConfig().defaultPackagePath;
    this.pendingSourcePathInfos = new Map();
    // Array of sourcePathInfos for directories
    this.pendingDirectories = [];

    this.logger.debug(`this.wsPath: ${this.wsPath}`);
    this.logger.debug(`this.defaultPackagePath: ${this.defaultPackagePath}`);
    this.logger.debug(`this.defaultSrcDir: ${this.defaultSrcDir}`);
    this.logger.debug(`this.fromConvert: ${this.fromConvert}`);
    this.logger.debug(`this.isStateless: ${this.isStateless}`);
    // mdapi:convert and source:convert do not need to load changed aggregate source elements.
    // The cache is specific to push, pull, status commands, but sourceWorkspaceAdapter is
    // initialized for all source-related commands
    if (!this.fromConvert) {
      this.changedSourceElementsCache = await this.getAggregateSourceElements(true, null, true);
    }
  }

  public async revertSourcePathInfos() {
    this.logger.debug('reverting source path infos');
    await this.spsm.revert();
  }

  public async backupSourcePathInfos() {
    this.logger.debug('backup source path infos');
    await this.spsm.backup();
  }

  public updatePendingSourcePathInfos(change: SourcePathInfo) {
    const packageSourcePathInfos = this.pendingSourcePathInfos.get(change.package) || new Map();
    const updated = packageSourcePathInfos.set(change.sourcePath, change);
    this.pendingSourcePathInfos.set(change.package, updated);
  }

  public getPendingSourcePathInfos(packageName?: string): SourcePathInfo[] {
    if (packageName) {
      return Array.from(this.pendingSourcePathInfos.get(packageName).values());
    } else {
      let elements = [];
      this.pendingSourcePathInfos.forEach(sourceElements => {
        sourceElements.forEach(value => elements.push(value));
      });
      return elements;
    }
  }

  /**
   * Get AggregateSourceElements (ASEs) in the workspace.
   *
   * To get all ASEs: SourceWorkspaceAdapter.getAggregateSourceElements(false);
   *    NOTE: This caches all ASEs so that subsequent calls do not incur this perf hit and just return the cache.
   *
   * To get all changed ASEs: SourceWorkspaceAdapter.getAggregateSourceElements(true);
   *
   * To get only ASEs from a certain path: SourceWorkspaceAdapter.getAggregateSourceElements(false, undefined, undefined, myPath);
   *
   * @param changesOnly - If true then return only the updated source elements (changed, new, or deleted)
   * @param packageDirectory - the package directory from which to fetch source
   * @param updatePendingPathInfos - the pending path infos should only be updated the first time this method is called
   *      in order to prevent subsequent calls from overwriting its values
   * @param sourcePath the directory or file path specified for change-set development
   * @returns - Map of aggregate source element key to aggregateSourceElement
   * ex. { 'ApexClass__myApexClass' : aggregateSourceElement }
   */
  public async getAggregateSourceElements(
    changesOnly: boolean,
    packageDirectory?: string,
    updatePendingPathInfos = false,
    sourcePath?: string
  ): Promise<AggregateSourceElements> {
    if (!changesOnly && !this.allAggregateSourceElementsCache.isEmpty()) {
      return this.allAggregateSourceElementsCache;
    }

    const aggregateSourceElementsByPkg = new AggregateSourceElements();
    // Retrieve sourcePathInfos from the manager, filtered by what we want.
    const pendingChanges = await this.spsm.getSourcePathInfos({
      changesOnly,
      packageDirectory,
      sourcePath
    });

    pendingChanges.forEach(change => {
      // Skip the directories
      if (change.isDirectory) {
        if (updatePendingPathInfos) {
          this.pendingDirectories.push(change);
        }
        return;
      }

      if (isEmpty(change.sourcePath) || !isString(change.sourcePath)) {
        throw SfdxError.create('salesforce-alm', 'source_workspace_adapter', 'invalid_source_path', [
          change.sourcePath
        ]);
      }

      const workspaceElementMetadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(
        change.sourcePath,
        this.metadataRegistry
      );

      // If this isn't a source file skip it
      if (!workspaceElementMetadataType) {
        return;
      }

      // Does the metadata registry have this type blocklisted.
      if (!this.metadataRegistry.isSupported(workspaceElementMetadataType.getMetadataName())) {
        _logUnsupported.call(this, workspaceElementMetadataType.getMetadataName(), change.sourcePath);
        return;
      }

      const aggregateFullName = workspaceElementMetadataType.getAggregateFullNameFromFilePath(change.sourcePath);
      // In some cases getAggregateMetadataFilePathFromWorkspacePath is doing path.joins.. That requires null checking
      // the sourcePath. We really really need strict null checking.
      const aggregateMetadataFilePath = workspaceElementMetadataType.getAggregateMetadataFilePathFromWorkspacePath(
        change.sourcePath
      );

      const aggregateMetadataType = MetadataTypeFactory.getAggregateMetadataType(
        workspaceElementMetadataType.getAggregateMetadataName(),
        this.metadataRegistry
      );

      const newAggregateSourceElement = new AggregateSourceElement(
        aggregateMetadataType,
        aggregateFullName,
        aggregateMetadataFilePath,
        this.metadataRegistry
      );
      const workspaceFullName = workspaceElementMetadataType.getFullNameFromFilePath(change.sourcePath);
      const deleteSupported = workspaceElementMetadataType.deleteSupported(workspaceFullName);
      const workspaceElement = new WorkspaceElement(
        workspaceElementMetadataType.getMetadataName(),
        workspaceFullName,
        change.sourcePath,
        change.state,
        deleteSupported
      );
      const packageName = change.package;
      const key = newAggregateSourceElement.getKey();

      const aggregateSourceElement =
        aggregateSourceElementsByPkg.getSourceElement(packageName, key) || newAggregateSourceElement;

      aggregateSourceElement.addWorkspaceElement(workspaceElement);

      aggregateSourceElementsByPkg.setIn(packageName, key, aggregateSourceElement);

      const deprecationMessage = aggregateMetadataType.getDeprecationMessage(aggregateFullName);
      if (deprecationMessage && changesOnly) {
        this.warnUser(undefined, deprecationMessage);
      }

      if (updatePendingPathInfos) {
        this.updatePendingSourcePathInfos(change);
      }
    });

    if (!changesOnly && !sourcePath) {
      // We just created ASEs for all workspace elements so cache it.
      this.allAggregateSourceElementsCache = aggregateSourceElementsByPkg;
    }

    return aggregateSourceElementsByPkg;
  }

  /**
   * Commit pending changed file infos
   * @returns {boolean} - Was the commit successful
   */
  public async commitPendingChanges(packageName: string): Promise<boolean> {
    if (!this.pendingSourcePathInfos && !this.pendingDirectories) {
      // getChanges or getAll must have been called prior to find the list
      //   of pending changes
      return false;
    }

    let pendingChanges = [];

    if (!util.isNullOrUndefined(this.pendingDirectories)) {
      // be wary of directories that get deleted by cleanup methods
      pendingChanges = pendingChanges.concat(this.pendingDirectories);
    }

    pendingChanges = pendingChanges.concat(this.getPendingSourcePathInfos(packageName));
    if (pendingChanges.length > 0) {
      this.logger.debug(`committing ${pendingChanges.length} pending changes`);
    } else {
      this.logger.debug('no changes to commit');
    }
    await this.spsm.commitChangedPathInfos(pendingChanges);
    return true;
  }

  /**
   * Update the source stored in the workspace
   */
  public async updateSource(
    aggregateSourceElements: AggregateSourceElements,
    manifest?,
    checkForDuplicates?: boolean,
    unsupportedMimeTypes?,
    forceoverwrite = false
  ) {
    let updatedPaths = [];
    let deletedPaths = [];

    this.logger.debug(`updateSource checkForDuplicates: ${checkForDuplicates}`);

    for (let sourceElement of aggregateSourceElements.getAllSourceElements()) {
      if (checkForDuplicates) {
        sourceElement.checkForDuplicates();
      }

      const [newPathsForElements, updatedPathsForElements, deletedPathsForElements] = sourceElement.commit(
        manifest,
        unsupportedMimeTypes,
        forceoverwrite
      );
      updatedPaths = updatedPaths.concat(newPathsForElements, updatedPathsForElements);
      deletedPaths = deletedPaths.concat(deletedPathsForElements);
    }

    this.logger.debug(`updateSource updatedPaths.length: ${updatedPaths.length}`);
    this.logger.debug(`updateSource deletedPaths.length: ${deletedPaths.length}`);

    await this.spsm.updateInfosForPaths(updatedPaths, deletedPaths);

    return aggregateSourceElements;
  }

  /**
   * Create a source element representation of a metadata change in the local workspace
   */
  public processMdapiFileProperty(
    changedSourceElements: AggregateSourceElements,
    retrieveRoot: string,
    fileProperty: FileProperty,
    bundleFileProperties
  ) {
    this.logger.debug(`processMdapiFileProperty retrieveRoot: ${retrieveRoot}`);
    // Right now, all fileProperties returned by the mdapi are for aggregate metadata types
    const aggregateMetadataType = MetadataTypeFactory.getMetadataTypeFromFileProperty(
      fileProperty,
      this.metadataRegistry
    );

    const aggregateFullName = aggregateMetadataType.getAggregateFullNameFromFileProperty(fileProperty, this.namespace);

    this.logger.debug(`processMdapiFileProperty aggregateFullName: ${aggregateFullName}`);

    let aggregateMetadataPath;

    if (!this.metadataRegistry.isSupported(aggregateMetadataType.getMetadataName())) {
      return null;
    }

    // This searches the known metadata file paths on the local file system for one that matches our aggregateFullName
    aggregateMetadataPath = this.sourceLocations.getMetadataPath(
      aggregateMetadataType.getMetadataName(),
      aggregateFullName
    );
    this.logger.debug(`processMdapiFileProperty aggregateMetadataPath: ${aggregateMetadataPath}`);
    if (
      !!aggregateMetadataPath &&
      this.fromConvert &&
      !this.defaultSrcDir.includes(this.defaultPackagePath) &&
      !aggregateMetadataPath.includes(this.defaultSrcDir)
    ) {
      // if a user specified a destination folder outside the default package directory and
      // a file with same type and name exists but in a different pacakge directory then ignore it
      aggregateMetadataPath = null;
    }

    const workspaceElementsToDelete = aggregateMetadataType.getWorkspaceElementsToDelete(
      aggregateMetadataPath,
      fileProperty
    );

    // If the metadata path wasn't found we will use the default source directory
    if (!aggregateMetadataPath) {
      aggregateMetadataPath = aggregateMetadataType.getDefaultAggregateMetadataPath(
        aggregateFullName,
        this.defaultSrcDir,
        bundleFileProperties
      );
      // Add the new path to the location mapping
      this.sourceLocations.addMetadataPath(
        aggregateMetadataType.getAggregateMetadataName(),
        aggregateFullName,
        aggregateMetadataPath
      );
    }
    if (this.forceIgnore.accepts(aggregateMetadataPath)) {
      this.logger.debug(`processMdapiFileProperty this.forceIgnore.accepts(aggregateMetadataPath): true`);
      const newAggregateSourceElement = new AggregateSourceElement(
        aggregateMetadataType,
        aggregateFullName,
        aggregateMetadataPath,
        this.metadataRegistry
      );
      const key = AggregateSourceElement.getKeyFromMetadataNameAndFullName(
        aggregateMetadataType.getMetadataName(),
        aggregateFullName
      );

      this.logger.debug(`processMdapiFilePropertykey: ${key}`);
      const aggregateSourceElement =
        changedSourceElements.getSourceElement(newAggregateSourceElement.getPackageName(), key) ||
        newAggregateSourceElement;
      if (workspaceElementsToDelete.length > 0) {
        workspaceElementsToDelete.forEach(deletedElement => {
          aggregateSourceElement.addPendingDeletedWorkspaceElement(deletedElement);
        });
      }

      aggregateSourceElement.retrievedMetadataPath = aggregateMetadataType.getRetrievedMetadataPath(
        fileProperty,
        retrieveRoot,
        bundleFileProperties
      );
      this.logger.debug(
        `processMdapiFileProperty aggregateSourceElement.retrievedMetadataPath: ${aggregateSourceElement.retrievedMetadataPath}`
      );
      const retrievedContentPath = aggregateMetadataType.getRetrievedContentPath(fileProperty, retrieveRoot);
      this.logger.debug(`retrievedContentPath: ${retrievedContentPath}`);
      if (retrievedContentPath) {
        if (!aggregateSourceElement.retrievedContentPaths) {
          aggregateSourceElement.retrievedContentPaths = [];
        }
        aggregateSourceElement.retrievedContentPaths.push(retrievedContentPath);
      }

      changedSourceElements.setIn(aggregateSourceElement.getPackageName(), key, aggregateSourceElement);
      return aggregateSourceElement;
    }
    return null;
  }

  /**
   * Create a source element representation of a deleted metadata change in the local workspace
   * @returns {AggregateSourceElement} - A source element or null if metadataType is not supported
   */
  public handleObsoleteSource(
    changedSourceElements: AggregateSourceElements,
    fullName: string,
    type: string
  ): AggregateSourceElement | null {
    this.logger.debug(`handleObsoleteSource fullName: ${fullName}`);
    const sourceMemberMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(type, this.metadataRegistry);
    const aggregateFullName = sourceMemberMetadataType.getAggregateFullNameFromSourceMemberName(fullName);
    this.logger.debug(`handleObsoleteSource aggregateFullName: ${aggregateFullName}`);

    let metadataPath: string = this.sourceLocations.getMetadataPath(
      sourceMemberMetadataType.getAggregateMetadataName(),
      aggregateFullName
    );
    if (!metadataPath) {
      metadataPath = this.sourceLocations.getMetadataPath(type, aggregateFullName);
    }
    this.logger.debug(`handleObsoleteSource metadataPath: ${metadataPath}`);
    if (metadataPath !== undefined) {
      const key = AggregateSourceElement.getKeyFromMetadataNameAndFullName(
        sourceMemberMetadataType.getAggregateMetadataName(),
        aggregateFullName
      );
      const packageName = this.packageInfoCache.getPackageNameFromSourcePath(metadataPath);
      this.logger.debug(`handleObsoleteSource key: ${key}, package: ${packageName}`);

      let aggregateSourceElement = changedSourceElements.getSourceElement(packageName, key);

      if (!aggregateSourceElement) {
        const aggregateMetadataType = MetadataTypeFactory.getAggregateMetadataType(
          sourceMemberMetadataType.getMetadataName(),
          this.metadataRegistry
        ); // only used in one place ( to create AggregateSourceElement )
        aggregateSourceElement = new AggregateSourceElement(
          aggregateMetadataType,
          aggregateFullName,
          metadataPath,
          this.metadataRegistry
        );
      }

      const shouldDeleteWorkspaceAggregate = sourceMemberMetadataType.shouldDeleteWorkspaceAggregate(type);
      this.logger.debug(`shouldDeleteWorkspaceAggregate: ${shouldDeleteWorkspaceAggregate}`);

      if (shouldDeleteWorkspaceAggregate) {
        aggregateSourceElement.markForDelete();
      } else {
        // the type is decomposed or AuraDefinition and we only want to delete components of an aggregate element
        const sourcePathsToDelete = aggregateSourceElement.getWorkspacePathsForTypeAndFullName(
          sourceMemberMetadataType.getMetadataName(),
          fullName
        );
        sourcePathsToDelete.forEach(sourcePathToDelete => {
          const deletedWorkspaceElement = new WorkspaceElement(
            sourceMemberMetadataType.getMetadataName(),
            fullName,
            sourcePathToDelete,
            sourceState.DELETED,
            true
          );
          this.logger.debug(`add pending deleted workspace element: ${fullName}`);
          aggregateSourceElement.addPendingDeletedWorkspaceElement(deletedWorkspaceElement);
        });
      }

      changedSourceElements.setIn(aggregateSourceElement.packageName, key, aggregateSourceElement);
      return aggregateSourceElement;
    }
    return null;
  }

  // Private to do move to UX.
  private warnUser(context: { flags: { json: boolean }; warnings: any[] }, message: string) {
    const warning = `${chalk.default.yellow('WARNING:')}`;
    this.logger.warn(warning, message);
    if (this.logger.shouldLog(LoggerLevel.WARN)) {
      if (context && context.flags.json) {
        if (!context.warnings) {
          context.warnings = [];
        }
        context.warnings.push(message);
        // Also log the message if valid stderr with json going to stdout.
        if (env.getBoolean('SFDX_JSON_TO_STDOUT', true)) {
          console.error(warning, message); // eslint-disable-line no-console
        }
      } else {
        console.error(warning, message); // eslint-disable-line no-console
      }
    }
  }
}

/**
 * Adapter between scratch org source metadata and a local workspace
 */
export namespace SourceWorkspaceAdapter {
  /**
   * Constructor Options for and Org.
   */
  export interface Options {
    /**
     * The org that the source workspace files belong to
     */
    org: any;
    /**
     * The name of the default package path to which new source will be added
     */
    defaultPackagePath: string;
    metadataRegistryImpl: any;
    fromConvert?: boolean;
    sourceMode?: number;
  }

  export const modes = { STATE: 0, STATELESS: 1 };
}

export type PendingSourcePathInfos = Map<string, Map<string, SourcePathInfo>>;

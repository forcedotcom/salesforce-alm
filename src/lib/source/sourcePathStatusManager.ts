/*
 * Copyright, 1999-2016, salesforce.com
 * All Rights Reserved
 * Company Confidential
 */
import * as fs from 'fs';
import * as path from 'path';

import * as _sourceState from './sourceState';
import MetadataRegistry = require('./metadataRegistry');
import { ForceIgnore } from './forceIgnore';
import srcDevUtil = require('../core/srcDevUtil');
import Messages = require('../messages');
const messages = Messages();

import * as _ from 'lodash';

const Package2ConfigFileNames = ['package2-descriptor.json', 'package2-manifest.json'];

/**
 * Check if the given sourcePath should be ignored
 * @param {string} sourcePath - The file system path to be verified
 * @param forceIgnore
 * @returns {boolean}
 * @private
 */
const _isValidSourcePath = function(sourcePathInfo, forceIgnore, metadataRegistry) {
  const sourcePath = sourcePathInfo.sourcePath;

  let isValid = forceIgnore.accepts(sourcePath);

  const basename = path.basename(sourcePath);

  const isPackage2ConfigFile = Package2ConfigFileNames.includes(basename);

  isValid = !basename.startsWith('.') && !basename.endsWith('.dup') && isValid && !isPackage2ConfigFile;

  if (isValid && !_.isNil(metadataRegistry)) {
    if (!sourcePathInfo.isDirectory) {
      if (!metadataRegistry.isValidSourceFilePath(sourcePath)) {
        const error = new Error(`Unexpected file found in package directory: ${sourcePath}`);
        error['name'] = 'UnexpectedFileFound';
        throw error;
      }
    }
  }

  // Skip directories/files beginning with '.', end with .dup, and that should be ignored
  return isValid;
};

/**
 * Information about a filesystem path used to track changes
 * @constructor
 */
function _SourcePathInfo() {}

/**
 * Initialize path info based on an object (used during deserialization)
 * @param {object} obj - The deserialized object representing the SourcePathInfo
 */
_SourcePathInfo.prototype.initFromObject = function(obj) {
  this.sourcePath = obj.sourcePath;
  this.isDirectory = obj.isDirectory;
  this.size = obj.size;
  this.modifiedTime = obj.modifiedTime;
  this.changeTime = obj.changeTime;
  this.contentHash = obj.contentHash;
  this.isMetadataFile = obj.isMetadataFile;
  this.state = obj.state;
  this.isWorkspace = obj.isWorkspace;
  this.isArtifactRoot = obj.isArtifactRoot;
};

/**
 * Initialize path info based on a path in the workspace
 * @param {string} sourcePath - The path to the source file in the workspace
 * @param {boolean} deferContentHash - Whether or not to defer computing the hash for the file system contents at this sourcePath
 */
_SourcePathInfo.prototype.initFromPath = function(sourcePath, deferContentHash) {
  // If we are initializing from path then the path is new
  this.state = _sourceState.NEW;
  this.sourcePath = sourcePath;
  let filestat;
  try {
    filestat = fs.statSync(sourcePath);
  } catch (e) {
    // If there is an error with filestat then the path is deleted
    this.state = _sourceState.DELETED;
    return;
  }
  this.isDirectory = filestat.isDirectory();
  this.isMetadataFile = !this.isDirectory && this.sourcePath.endsWith(MetadataRegistry.getMetadataFileExt());

  this.size = filestat.size;
  this.modifiedTime = filestat.mtime.getTime();
  this.changeTime = filestat.ctime.getTime();
  if (!deferContentHash) {
    this.computeContentHash();
  }
};

_SourcePathInfo.prototype.computeContentHash = function() {
  const contents = this.isDirectory ? fs.readdirSync(this.sourcePath).toString() : fs.readFileSync(this.sourcePath);
  this.contentHash = srcDevUtil.getContentHash(contents);
};

/**
 * If the source has been modified, return the path info for the change
 * @returns {_SourcePathInfo} - The path info for the change if modified, otherwise null
 */
_SourcePathInfo.prototype.getPendingPathInfo = function() {
  const pendingPathInfo = new _SourcePathInfo();
  // Defer computing content hash until we know we need to check it
  pendingPathInfo.initFromPath(this.sourcePath, true);
  pendingPathInfo.isWorkspace = this.isWorkspace;
  // See if the referenced path has been deleted
  if (pendingPathInfo.isDeleted()) {
    // Force setting isDirectory and isMetadataFile for deleted paths
    pendingPathInfo.isDirectory = this.isDirectory;
    pendingPathInfo.isMetadataFile = this.isMetadataFile;
    return pendingPathInfo;
  }
  // Unless deleted, new paths always return true. no need for further checks
  if (this.state === _sourceState.NEW) {
    return this;
  }
  // Next we'll check if the path infos are different
  if (
    pendingPathInfo.isDirectory || // Always need to compare the hash on directories
    pendingPathInfo.size !== this.size ||
    pendingPathInfo.modifiedTime !== this.modifiedTime ||
    pendingPathInfo.changedTime !== this.changedTime
  ) {
    // Now we will compare the content hashes
    pendingPathInfo.computeContentHash();
    if (pendingPathInfo.contentHash !== this.contentHash) {
      pendingPathInfo.state = _sourceState.CHANGED;
      return pendingPathInfo;
    } else {
      // The hashes are the same, so the file hasn't really changed. Update our info.
      //   These will automatically get saved when other pending changes are committed
      this.size = pendingPathInfo.size;
      this.modifiedTime = pendingPathInfo.modifiedTime;
      this.changedTime = pendingPathInfo.changedTime;
    }
  }
  return null;
};

_SourcePathInfo.prototype.isDeleted = function() {
  return this.state === _sourceState.DELETED;
};

_SourcePathInfo.prototype.getState = function() {
  return _sourceState.toString(this.state);
};

/**
 * Get the path infos for newly added source
 * @param {string} sourcePath - The path to the newly added source
 * @param forceIgnore
 * @param {MetadataRegistry} metadataRegistry - The database of metadata types
 * @returns {Array} - The added path info(s)
 * @private
 */
const _getNewPathInfos = function(sourcePath, forceIgnore, metadataRegistry) {
  let newPathInfos = [];
  const newPathInfo = new _SourcePathInfo();
  newPathInfo.initFromPath(sourcePath, false, metadataRegistry);

  if (_isValidSourcePath(newPathInfo, forceIgnore, metadataRegistry)) {
    newPathInfos.push(newPathInfo);
    if (newPathInfo.isDirectory) {
      const files = fs.readdirSync(sourcePath);
      files
        .map(file => path.join(sourcePath, file))
        .forEach(file => {
          newPathInfos = newPathInfos.concat(_getNewPathInfos(file, forceIgnore, metadataRegistry));
        });
    }
  }
  return newPathInfos;
};

/**
 * Create a new _SourcePathInfo from the given sourcePath
 * @param {string} sourcePath - the path for which the _SourcePathInfo will be created
 * @param {boolean} isWorkspace - true if the sourcePath is the path to the workspace directory
 * @param {boolean} isArtifactRoot - true if the sourcePath is the path to an artifact root directory
 * @param {MetadataRegistry} metadataRegistry - The database of metadata types
 * @returns {_SourcePathInfo}
 * @private
 */
const _createSourcePathInfoFromPath = function(sourcePath, isWorkspace, isArtifactRoot, metadataRegistry) {
  const sourcePathInfo = new _SourcePathInfo();
  sourcePathInfo.initFromPath(sourcePath, false, metadataRegistry);
  sourcePathInfo.isWorkspace = isWorkspace;
  sourcePathInfo.isArtifactRoot = isArtifactRoot;

  return sourcePathInfo;
};

/**
 * Update the data model for a given path
 * @param {string} sourcePath - The workspace path to update from
 * @param {Map} workspacePathInfos - The data model to update
 * @param forceIgnore
 * @param {boolean} isWorkspace - true if the sourcePath is the path to the workspace directory
 * @param {boolean} isArtifactRoot - true if the sourcePath is the path to an artifact root directory
 * @param {MetadataRegistry} metadataRegistry - The database of metadata types
 * @private
 */
const _updateFromPath = function(
  sourcePath,
  workspacePathInfos,
  forceIgnore,
  isWorkspace,
  isArtifactRoot,
  metadataRegistry
) {
  const sourcePathInfo = _createSourcePathInfoFromPath(sourcePath, isWorkspace, isArtifactRoot, metadataRegistry);
  workspacePathInfos.set(sourcePath, sourcePathInfo);

  if (sourcePathInfo.isDirectory) {
    const dirfiles = fs.readdirSync(sourcePath);
    dirfiles
      .map(file => path.join(sourcePath, file))
      .filter(file => {
        const fileSourcePathInfo = _createSourcePathInfoFromPath(file, isWorkspace, isArtifactRoot, metadataRegistry);
        return _isValidSourcePath(fileSourcePathInfo, forceIgnore, metadataRegistry);
      })
      .forEach(file => _updateFromPath(file, workspacePathInfos, forceIgnore, false, false, metadataRegistry));
  }
};

/**
 * Write the data model out to the workspace
 * @param org - The org the source path file belongs to
 * @param sourcePathInfos - The data mode
 * @private
 */
const _writeSourcePathInfos = function(org, workspacePath, workspacePathInfos) {
  // The workspace home directory should always be included in the workspacePathInfos
  if (_.isNil(workspacePathInfos.get(workspacePath))) {
    const workspaceSourcePathInfo = _createSourcePathInfoFromPath(workspacePath, true, false, undefined);
    workspacePathInfos.set(workspacePath, workspaceSourcePathInfo);
  }

  return org.getSourcePathInfos().write([...workspacePathInfos]);
};

/**
 * Adds the _SourcePathInfos of a new artifact to the data model
 * @param {string} artifactPath - The path to the artifact's root directory
 * @param {Map} workspacePathInfos - The data model for the directories and files to be tracked
 * @param forceIgnore
 * @param {MetadataRegistry} - The database of metadata types
 */
const _addNewArtifact = function(artifactPath, workspacePathInfos, forceIgnore, metadataRegistry) {
  const isWorkspace = false;
  const isArtifactRoot = true;
  _updateFromPath(artifactPath, workspacePathInfos, forceIgnore, isWorkspace, isArtifactRoot, metadataRegistry);
};

/**
 * Initialize the data model for source change tracking
 * @param {object} org - The org for this workspace
 * @param forceIgnore
 * @param {MetadataRegistry} - The database of metadata types
 * @returns {[{Map}, []]} - An array containing the data model and the artifact root directories
 * @private
 */
const _initializeWorkspace = function(org, forceIgnore, metadataRegistry) {
  const workspacePath = org.config.getProjectPath();
  const workspacePathInfos = new Map();
  const artifactRootPaths = org.config.getAppConfig().packageDirectoryPaths;
  artifactRootPaths.forEach(artifactPath => {
    if (!srcDevUtil.pathExistsSync(artifactPath)) {
      const error = new Error(messages.getMessage('InvalidPackageDirectory', artifactPath));
      error['name'] = 'InvalidProjectWorkspace';
      throw error;
    }
    _addNewArtifact(artifactPath, workspacePathInfos, forceIgnore, metadataRegistry);
  });
  _writeSourcePathInfos(org, workspacePath, workspacePathInfos);
  return [workspacePathInfos, artifactRootPaths];
};

/**
 * Get the path infos for source that has been updated in the given directory
 * @param {string} directoryPath - The directory with updated contents
 * @param {Map} workspacePathInfos - The data model for known source
 * @param forceIgnore
 * @param {MetadataRegistry} metadataRegistry - The database of metadata types
 * @returns {Array} - The path infos for the updated source
 * @private
 */
const _processChangedDirectory = function(directoryPath, workspacePathInfos, forceIgnore, metadataRegistry) {
  let updatedPathInfos = [];
  // If the path is a directory and wasn't deleted then we want to process the contents for changes
  const files = fs.readdirSync(directoryPath);
  files
    .map(file => path.join(directoryPath, file))
    .filter(
      file =>
        // We only need to process additions to the directory, any existing ones will get dealt with on their own
        !workspacePathInfos.has(file)
    )
    .forEach(file => {
      // This is new, so add it to the change list
      updatedPathInfos = updatedPathInfos.concat(_getNewPathInfos(file, forceIgnore, metadataRegistry));
    });
  return updatedPathInfos;
};

/**
 * Read the data model from the workspace
 * @param {object} org - The org the source file belongs to
 * @returns {[{Map}, []]} - The data model, or null if the data file does not exist in the workspace, and the artifact root directory paths
 * @private
 */
const _readSourcePathInfos = function(org) {
  const workspacePath = org.config.getProjectPath();
  let sourcePathInfos;
  let workspacePathChanged;
  const artifactRootPaths = [];
  try {
    const oldSourcePathInfos = new Map<any, any>(org.getSourcePathInfos().read());

    let oldWorkspacePath;
    for (const sourcePathInfoObj of oldSourcePathInfos.values()) {
      if (sourcePathInfoObj.isWorkspace) {
        oldWorkspacePath = sourcePathInfoObj.sourcePath;
      }
      if (sourcePathInfoObj.isArtifactRoot) {
        artifactRootPaths.push(sourcePathInfoObj.sourcePath);
      }
    }

    workspacePathChanged = !_.isNil(oldWorkspacePath) && workspacePath !== oldWorkspacePath;

    // Wrap parsed objects in SourcePathInfos
    sourcePathInfos = new Map();
    for (const sourcePathInfoObj of oldSourcePathInfos.values()) {
      const sourcePathInfo = new _SourcePathInfo();
      sourcePathInfo.initFromObject(sourcePathInfoObj);

      if (workspacePathChanged) {
        sourcePathInfo.sourcePath = path.join(
          workspacePath,
          path.relative(oldWorkspacePath, sourcePathInfo.sourcePath)
        );
      }
      sourcePathInfos.set(sourcePathInfo.sourcePath, sourcePathInfo);
    }
  } catch (e) {
    // Do nothing if the file can't be read, which will cause the workspace to be initialized
  }

  if (workspacePathChanged) {
    _writeSourcePathInfos(org, workspacePath, sourcePathInfos);
  }
  return [sourcePathInfos, artifactRootPaths];
};

/**
 * Manages a data model for tracking changes to local workspace paths
 * @param org - The org that the source files will belong to
 * @constructor
 */
function SourcePathStatusManager(org, isStateless?) {
  this.org = org;
  this.workspacePath = org.config.getProjectPath();
  this.metadataRegistry = new MetadataRegistry(this.org);
  this.forceIgnore = new ForceIgnore();
  this.isStateless = isStateless;

  // Try to load the saved source state if we care about state.
  if (!isStateless) {
    [this.workspacePathInfos, this.artifactRootPaths] = _readSourcePathInfos(this.org);
    if (_.isNil(this.workspacePathInfos)) {
      // If not found, initialize from workspace
      [this.workspacePathInfos, this.artifactRootPaths] = _initializeWorkspace(
        this.org,
        this.forceIgnore,
        this.metadataRegistry
      );
    }
  } else {
    this.workspacePathInfos = new Map();
    this.artifactRootPaths = org.config.getAppConfig().packageDirectoryPaths || [];
  }
}

SourcePathStatusManager.prototype.revert = function() {
  this.org.getSourcePathInfos().revert();
};

SourcePathStatusManager.prototype.backup = function() {
  this.org.getSourcePathInfos().backup();
};

/**
 * Get path infos for the source workspace, applying any filters specified.
 *
 * @param filter {object} Filter object to use for filtering sourcePathInfos with these properties:
 *      changesOnly - If true then return only the updated source paths (changed, new, or deleted)
 *      packageDirectory - The package directory from which to fetch the sourcePathInfos
 *      sourcePath - Path to a file or directory within the project to match sourcePathInfos
 * @returns {Array} - The path infos for the workspace
 */
SourcePathStatusManager.prototype.getSourcePathInfos = function(filter: any = {}) {
  const { packageDirectory, changesOnly, sourcePath } = filter;
  const oldArtifactRootPaths = this.artifactRootPaths;
  const currentArtifactRootPaths = this.org.config.getAppConfig().packageDirectoryPaths;
  const untrackedArtifactRootPaths = currentArtifactRootPaths.filter(
    rootDir => !oldArtifactRootPaths.includes(rootDir)
  );

  // if a root directory is specified, make sure it is a project source directory
  if (
    !_.isNil(packageDirectory) &&
    _.isNil(currentArtifactRootPaths.find(rootDir => packageDirectory.startsWith(rootDir)))
  ) {
    throw new Error(messages.getMessage('rootDirectoryNotASourceDirectory', [], 'sourceConvertCommand'));
  }

  // If a sourcePath was passed in and we are in stateless mode (e.g., changesets)
  // add only the specified source path to workspacePathInfos.
  if (this.isStateless && sourcePath) {
    _addNewArtifact(sourcePath, this.workspacePathInfos, this.forceIgnore, this.metadataRegistry);
  } else {
    if (untrackedArtifactRootPaths.length > 0) {
      untrackedArtifactRootPaths.forEach(artifactPath => {
        if (!srcDevUtil.pathExistsSync(artifactPath)) {
          const error = new Error(messages.getMessage('InvalidPackageDirectory', artifactPath));
          error['name'] = 'InvalidProjectWorkspace';
          throw error;
        }
        _addNewArtifact(artifactPath, this.workspacePathInfos, this.forceIgnore, this.metadataRegistry);
      });
    }
  }

  let sourcePathInfos = [];
  for (const sourcePathInfo of this.workspacePathInfos.values()) {
    // default to including this sourcePathInfo
    let shouldIncludeSourcePathInfo = true;

    // Filter out first by packageDirectory, then sourcePath, then .forceignore
    if (packageDirectory) {
      shouldIncludeSourcePathInfo = sourcePathInfo.sourcePath.includes(packageDirectory + path.sep);
    }
    if (shouldIncludeSourcePathInfo && sourcePath) {
      shouldIncludeSourcePathInfo = sourcePathInfo.sourcePath.includes(sourcePath);
    }
    if (this.forceIgnore.denies(sourcePathInfo.sourcePath)) {
      shouldIncludeSourcePathInfo = false;
    }

    const pendingSourcePathInfo = sourcePathInfo.getPendingPathInfo();
    if (_.isNil(pendingSourcePathInfo)) {
      // Null pendingSourcePathInfo means the sourcePathInfo has not changed
      if (!changesOnly) {
        // If the path didn't change and we aren't limiting to changes then add it
        if (shouldIncludeSourcePathInfo) {
          sourcePathInfos.push(sourcePathInfo);
        }
      }
    } else {
      if (shouldIncludeSourcePathInfo) {
        // The path has changed so add it
        sourcePathInfos.push(pendingSourcePathInfo);
        if (
          pendingSourcePathInfo.isDirectory &&
          !pendingSourcePathInfo.isDeleted() &&
          !pendingSourcePathInfo.isWorkspace
        ) {
          // If it's a directory and it isn't deleted then process the directory change
          sourcePathInfos = sourcePathInfos.concat(
            _processChangedDirectory(
              pendingSourcePathInfo.sourcePath,
              this.workspacePathInfos,
              this.forceIgnore,
              this.metadataRegistry
            )
          );
        }
      }
    }
  }

  return sourcePathInfos;
};

/**
 * Update the data model with changes
 * @param sourcePathInfos - Path infos for the workspace
 */
SourcePathStatusManager.prototype.commitChangedPathInfos = function(sourcePathInfos) {
  for (const sourcePathInfo of sourcePathInfos) {
    if (sourcePathInfo.state !== _sourceState.UNCHANGED) {
      if (sourcePathInfo.isDeleted()) {
        this.workspacePathInfos.delete(sourcePathInfo.sourcePath);
      } else {
        sourcePathInfo.state = _sourceState.UNCHANGED;
        this.workspacePathInfos.set(sourcePathInfo.sourcePath, sourcePathInfo);
      }
    }
  }
  _writeSourcePathInfos(this.org, this.workspacePath, this.workspacePathInfos);
};

/**
 * Update data model for the given paths
 * @param updatedPaths - Paths to files which have been updated (new, changed)
 * @param deletedPaths - Paths to files which have been deleted
 */
SourcePathStatusManager.prototype.updateInfosForPaths = function(updatedPaths, deletedPaths) {
  // check if the parent paths of updated paths need to be added to workspacePathInfos too
  for (const updatedPath of updatedPaths.slice()) {
    if (!this.workspacePathInfos.has(updatedPath)) {
      const sourcePath = updatedPath.split(path.sep);
      while (sourcePath.length > 1) {
        sourcePath.pop();
        const parentPath = sourcePath.join(path.sep);
        updatedPaths.push(parentPath);
        if (this.workspacePathInfos.has(parentPath)) {
          break;
        }
      }
    }
  }

  for (const deletedPath of deletedPaths) {
    this.workspacePathInfos.delete(deletedPath);
  }
  for (const updatedPath of updatedPaths) {
    const sourcePathInfo = new _SourcePathInfo();
    sourcePathInfo.initFromPath(updatedPath);
    sourcePathInfo.state = _sourceState.UNCHANGED;
    this.workspacePathInfos.set(updatedPath, sourcePathInfo);
  }

  _writeSourcePathInfos(this.org, this.workspacePath, this.workspacePathInfos);
};

export = SourcePathStatusManager;

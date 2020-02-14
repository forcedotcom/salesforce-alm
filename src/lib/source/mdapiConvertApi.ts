/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fsx from 'fs-extra';
import * as klaw from 'klaw';
import * as path from 'path';
import * as util from 'util';

import * as BBPromise from 'bluebird';
import * as optional from 'optional-js';
import * as _ from 'lodash';

import * as Force from '../core/force';
import MetadataRegistry = require('./metadataRegistry');
import * as almError from '../core/almError';
import logger = require('../core/logApi');
const glob = BBPromise.promisify(require('glob'));

import { AuraDefinitionBundleMetadataType } from './metadataTypeImpl/auraDefinitionBundleMetadataType';
import { WaveTemplateBundleMetadataType } from './metadataTypeImpl/waveTemplateBundleMetadataType';

import srcDevUtil = require('../core/srcDevUtil');
import Messages = require('../messages');
const messages = Messages();
import * as sourceState from './sourceState';
import * as SourceUtil from './sourceUtil';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { ForceIgnore } from './forceIgnore';
import { LightningComponentBundleMetadataType } from './metadataTypeImpl/lightningComponentBundleMetadataType';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { ManifestEntry } from './types';
import { getFileName } from './sourcePathUtil';
import { SfdxError } from '@salesforce/core';

const fsx_ensureDir = BBPromise.promisify(fsx.ensureDir);

/**
 * Helper to normalize a path
 * @param {string} targetValue - the raw path
 * @returns {string} - a trimmed path without a trailing slash.
 * @private
 */
const _normalizePath = function(targetValue) {
  let localTargetValue = targetValue.trim();
  if (localTargetValue.endsWith(path.sep)) {
    localTargetValue = localTargetValue.substr(0, localTargetValue.length - 1);
  }
  return path.resolve(localTargetValue);
};

/**
 * Process a file from the metadata package.
 * @param {object} typeDef - object type from the metadata registry
 * @param {string} pathWithPackage - the filepath including the metadata package
 * @param {string} fullName - the computed full name  @see _getFullName
 * @param sourceWorkspaceAdapter - the org/source workspace adapter
 * @param {[]} sourceElements - accumulator of created source elements
 * @private
 */
const _processFile = function(metadataType, pathWithPackage, fullName, sourceWorkspaceAdapter, sourceElements) {
  const fileProperties = {
    type: metadataType.getMetadataName(),
    fileName: pathWithPackage,
    fullName
  };

  const retrieveRoot = path.join(this._package_root, '..');

  // Each Aura bundle has a definition file that has one of the suffixes: .app, .cmp, .design, .evt, etc.
  // In order to associate each sub-component of an aura bundle (e.g. controller, style, etc.) with
  // its parent aura definition type, we must find the parent's file properties
  // and pass those along to processMdapiFileProperty()
  const bundleDefinitionProperty = [];
  if (metadataType instanceof AuraDefinitionBundleMetadataType) {
    const definitionFileProperty = AuraDefinitionBundleMetadataType.getCorrespondingAuraDefinitionFileProperty(
      retrieveRoot,
      fileProperties.fileName,
      metadataType.getMetadataName(),
      sourceWorkspaceAdapter.metadataRegistry
    );
    bundleDefinitionProperty.push(definitionFileProperty);
  }

  if (metadataType instanceof LightningComponentBundleMetadataType) {
    const metadataRegistry = sourceWorkspaceAdapter.metadataRegistry;
    const typeDefObj = metadataRegistry.getTypeDefinitionByMetadataName(metadataType.getMetadataName());
    const bundle = new LightningComponentBundleMetadataType(typeDefObj);
    const definitionFileProperty = bundle.getCorrespondingLWCDefinitionFileProperty(
      retrieveRoot,
      fileProperties.fileName,
      metadataType.getMetadataName(),
      sourceWorkspaceAdapter.metadataRegistry
    );
    bundleDefinitionProperty.push(definitionFileProperty);
  }

  if (metadataType instanceof WaveTemplateBundleMetadataType) {
    const definitionFileProperty = {
      type: metadataType.getMetadataName(),
      fileName: fileProperties.fileName,
      fullName
    };
    bundleDefinitionProperty.push(definitionFileProperty);
  }

  const element = sourceWorkspaceAdapter.processMdapiFileProperty(
    sourceElements,
    retrieveRoot,
    fileProperties,
    bundleDefinitionProperty
  );
  if (util.isNullOrUndefined(element)) {
    this.logger.warn(`Unsupported type: ${metadataType.getMetadataName()} path: ${pathWithPackage}`);
  }
};

/**
 * Process one file path within a metadata package directory
 * @param {object} item - the path item
 * @param {object} metadataRegistry - describe metadata
 * @param {object} sourceWorkspaceAdapter - workspace adapter
 * @param {array} sourceElements - accumulator of created source elements
 * @private
 */
const _processPath = function(item, metadataRegistry, sourceWorkspaceAdapter, sourceElements) {
  const pkgRelativePath = path.relative(this._package_root, item.path);
  if (pkgRelativePath.length > 0) {
    // Ignore the package root itself
    const metadataType = MetadataTypeFactory.getMetadataTypeFromMdapiPackagePath(pkgRelativePath, metadataRegistry);
    if (metadataType) {
      if (!item.path.endsWith(MetadataRegistry.getMetadataFileExt()) || metadataType.isFolderType()) {
        const pathWithPackage = path.join(path.basename(this._package_root), pkgRelativePath);
        const fullName = metadataType.getAggregateFullNameFromMdapiPackagePath(pkgRelativePath);

        if (item.stats.isFile()) {
          _processFile.call(this, metadataType, pathWithPackage, fullName, sourceWorkspaceAdapter, sourceElements);
        }
      } else {
        if (metadataType.hasContent()) {
          const indexOfMetaExt = item.path.indexOf(MetadataRegistry.getMetadataFileExt());
          const retrievedContentPath = item.path.substring(0, indexOfMetaExt);
          if (!srcDevUtil.pathExistsSync(retrievedContentPath)) {
            const err = new Error();
            err['name'] = 'Missing content file';
            err['message'] = messages.getMessage('MissingContentFile', retrievedContentPath);
            throw err;
          }
        }
      }
    } else {
      this.logger.warn(`The type definition cannot be found for ${item.path}`);
    }
  }
};

/**
 * Converts an array of aggregateSourceElements into objects suitable for a return to the caller.
 * @param {[]} aggregateSourceElements - array of aggregateSourceElements
 * @returns {[{state, fullName, type, filePath}]}
 */
const _mapToOutputElements = function(aggregateSourceElements) {
  let allWorkspaceElements = [];
  aggregateSourceElements.forEach(aggregateSourceElement => {
    allWorkspaceElements = allWorkspaceElements.concat(aggregateSourceElement.getWorkspaceElements());
  });

  return allWorkspaceElements.map(workspaceElement => {
    const fullFilePath = workspaceElement.getSourcePath();
    const paths = fullFilePath.split(this.projectPath);
    let filePath = paths[paths.length - 1];

    // Remove the leading slash
    if (!util.isNullOrUndefined(filePath) && path.isAbsolute(filePath)) {
      filePath = filePath.substring(1);
    }

    return {
      fullName: workspaceElement.getFullName(),
      type: workspaceElement.getMetadataName(),
      filePath,
      state: sourceState.toString(workspaceElement.getState())
    };
  });
};

/**
 * Finds the filepath root containing the package.xml
 * @private
 */
const _setPackageRoot = function() {
  const packageDotXmlPath = `${this.root}${path.sep}package.xml`;
  return glob(packageDotXmlPath).then(outerfiles => {
    if (outerfiles.length > 0) {
      this._package_root = this.root;
      return BBPromise.resolve();
    } else {
      const packageDotXmlGlobPath = `${this.root}${path.sep}**${path.sep}package.xml`;

      if (this.logger.isDebugEnabled()) {
        this.logger.debug(`Looking for package.xml here ${packageDotXmlGlobPath}`);
      }
      return glob(packageDotXmlGlobPath).then(innerfiles => {
        if (innerfiles.length < 1) {
          const error = new Error();
          error['code'] = 'ENOENT';
          throw error;
        }
        this._package_root = path.dirname(innerfiles[0]);
        return BBPromise.resolve();
      });
    }
  });
};

/**
 * An api class for converting a source directory in mdapi package format into source compatible with an SFDX workspace.
 */
class MdapiConvertApi {
  // TODO: proper property typing
  [property: string]: any;

  constructor(force?) {
    this.force = optional.ofNullable(force).orElse(new Force());
    this.projectPath = this.force.getConfig().getProjectPath();
    this._outputDirectory = this.force.getConfig().getAppConfig().defaultPackagePath;
    this.logger = logger.child('mdapiConvertApi');
  }

  /**
   * @returns {string} the directory for the output
   */
  get outputDirectory() {
    return this._outputDirectory;
  }

  /**
   * set the value of the output directory
   * @param {string} outputDirectory - the new value of the output directory.
   */
  set outputDirectory(outputDirectory) {
    if (_.isString(outputDirectory) && !_.isEmpty(outputDirectory)) {
      if (path.isAbsolute(outputDirectory)) {
        this._outputDirectory = path.relative(process.cwd(), outputDirectory);
      } else {
        this._outputDirectory = outputDirectory;
      }
    } else {
      throw almError('InvalidParameter', ['outputdir', outputDirectory]);
    }
  }

  /**
   * @returns {string} value of the root directory to convert. default to the project directory
   */
  get root() {
    return this._root;
  }

  /**
   * set the value of the root directory to convert
   * @param {string} sourceRootValue - a directory containing a package.xml file. Is should represents a valid mdapi
   * package.
   */
  set root(sourceRootValue) {
    if (sourceRootValue && typeof sourceRootValue === 'string' && sourceRootValue.trim().length > 0) {
      this._root = _normalizePath(sourceRootValue);
    } else {
      throw almError('InvalidParameter', ['sourceRootValue', sourceRootValue]);
    }
  }

  isValidSourcePath(sourcePath) {
    const isValid = this.forceIgnore.accepts(sourcePath);

    // Skip directories/files beginning with '.' and that should be ignored
    return isValid && !path.basename(sourcePath).startsWith('.');
  }

  /**
   * @param itemPath path of the metadata to convert
   * @param mdName name of metadata as given in -m parameter
   * @returns true if the file is a folder metadata type
   */
  isFolder(itemPath, mdName?) {
    return mdName && itemPath.endsWith(`${path.sep}${mdName.split(path.sep)[0]}-meta.xml`);
  }

  /**
   * @param itemPath  the path to the file in the local project
   * @param validMetatdata  a filter against which the paths would be checked to see if the file needs to be converted
   * @param metadataRegistry {MetadataRegistry}
   * @returns { boolean} returns true if the path is valid path for covert
   */
  checkMetadataFromType(itemPath: string, validMetatdata: string[], metadataRegistry: MetadataRegistry) {
    const typDef = metadataRegistry.getTypeDefinitionByFileName(itemPath);
    for (let md of validMetatdata) {
      const [mdType, mdName] = md.split(':');
      if (!mdName && typDef) {
        if (mdType === typDef.metadataName) {
          return true;
        }
      } else if (mdName) {
        if (itemPath.includes(mdName) || this.isFolder(itemPath, mdName)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * @param itemPath the path to the file in the local project
   * @param validMetatdata a filter against which the paths would be checked to see if the file needs to be converted
   */
  checkMetadataFromPath(itemPath: string, validMetatdata: string[]): boolean {
    for (let path of validMetatdata) {
      if (itemPath.includes(path)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param typeNamePairs  type name pairs from manifest
   * @param itemPath the path to the file in the local project
   * @param metadataRegistry
   * @returns  {boolean} true if the metadata type or, file name is present in the manifest
   */
  checkMetadataFromManifest(typeNamePairs: ManifestEntry[], itemPath: string, metadataRegistry: MetadataRegistry) {
    const typDef = metadataRegistry.getTypeDefinitionByFileName(itemPath);
    const metadataName = getFileName(itemPath);
    let foundInManifest = false;
    typeNamePairs.forEach((entry: ManifestEntry) => {
      if (typDef && entry.name.includes('*') && foundInManifest === false) {
        if (typDef.metadataName === entry.type) {
          foundInManifest = true;
        }
      }
      if (metadataName === entry.name) {
        foundInManifest = true;
      } else if (itemPath.includes(entry.name)) {
      /** For folder type structure  */
        foundInManifest = true;
      }
    });
    return foundInManifest;
  }

  /**
   * Returns a promise to convert a metadata api directory package into SFDX compatible source.
   * @returns {BBPromise}
   */
  convertSource(org, context?) {
    // Walk the metadata package elements.

    let validMetatdata;
    return org
      .resolveDefaultName()
      .then(() => fsx_ensureDir(this.root))
      .then(() => fsx_ensureDir(this._outputDirectory))
      .then(() => _setPackageRoot.call(this))
      .then(() => {
        if (context) {
          if (context.manifest) {
            return SourceUtil.parseToManifestEntriesArray(context.manifest);
          }

          if (context.metadata) {
            return context.metadata.split(',');
          } else if (context.metadatapath) {
            return context.metadatapath.split(',');
          }
        }
      })
      .then(result => {
        validMetatdata = result;
      })
      .then(() =>
        SourceWorkspaceAdapter.create({
          org: org,
          metadataRegistryImpl: MetadataRegistry,
          defaultPackagePath: path.relative(this.projectPath, this.outputDirectory),
          fromConvert: true
        })
      )
      .then((sourceWorkspaceAdapter: SourceWorkspaceAdapter) => {
        if (this.logger.isDebugEnabled()) {
          [
            { name: 'root', value: this.root },
            { name: 'outputdir', value: this._outputDirectory }
          ].forEach(attribute => {
            this.logger.debug(`Processing mdapi convert with ${attribute.name}: ${attribute.value}`);
          });
        }

        this.logger.debug(`Processing mdapi convert with package root: ${this._package_root}`);

        const metadataRegistry = new MetadataRegistry(org);
        const aggregateSourceElements = new Map();
        this.forceIgnore = new ForceIgnore(this._package_root);

        // Use a "new" promise to block the promise chain until the source metadata package is processed.
        return new BBPromise((resolve, reject) => {
          let errorFoundProcessingPath = false;
          klaw(this._package_root)
            .on('data', item => {
              try {
                if (this.isValidSourcePath(item.path)) {
                  if (!validMetatdata) {
                    _processPath.call(this, item, metadataRegistry, sourceWorkspaceAdapter, aggregateSourceElements);
                  } else if (context.metadatapath) {
                    const isValidMetatadataPath = this.checkMetadataFromPath(item.path, validMetatdata);
                    if (isValidMetatadataPath) {
                      _processPath.call(this, item, metadataRegistry, sourceWorkspaceAdapter, aggregateSourceElements);
                    }
                  } else if (context.manifest) {
                    const foundInManifest = this.checkMetadataFromManifest(validMetatdata, item.path, metadataRegistry);
                    if (foundInManifest) {
                      _processPath.call(this, item, metadataRegistry, sourceWorkspaceAdapter, aggregateSourceElements);
                    }
                  } else if (context.metadata) {
                    const validMetatdataType = this.checkMetadataFromType(item.path, validMetatdata, metadataRegistry);
                    if (validMetatdataType) {
                      _processPath.call(this, item, metadataRegistry, sourceWorkspaceAdapter, aggregateSourceElements);
                    }
                  }
                }
              } catch (e) {
                this.logger.debug(e.message);
                errorFoundProcessingPath = true;
                if (e.name === 'Missing metadata file' || e.name === 'Missing content file') {
                  reject(e);
                } else {
                  const message = messages.getMessage('errorProcessingPath', [item.path], 'mdapiConvertApi');
                  const error = new SfdxError(message, 'errorProcessingPath', undefined, undefined, e);
                  reject(error);
                }
              }
            })
            .on('end', () => {
              if (!errorFoundProcessingPath && aggregateSourceElements.size > 0) {
                sourceWorkspaceAdapter.updateSource(
                  aggregateSourceElements,
                  undefined,
                  undefined,
                  undefined,
                  true /** checkForDuplicates */,
                  this.unsupportedMimeTypes
                );
                if (this.logger.isDebugEnabled()) {
                  const allPaths = [];
                  aggregateSourceElements.forEach(aggregateSourceElement => {
                    const workspaceElements = aggregateSourceElement.getWorkspaceElements();
                    workspaceElements.forEach(workspaceElement => {
                      allPaths.push(workspaceElement.getSourcePath());
                    });
                  });
                  this.logger.debug(allPaths);
                }
              }
              resolve(_mapToOutputElements.call(this, aggregateSourceElements));
            })
            .on('error', (err, item) => {
              reject(almError({ keyName: 'errorProcessingPath', bundle: 'mdapiConvertApi' }, [item.path]));
            });
        });
      })
      .catch(err => {
        // Catch invalid source package.
        if (err.code && err.code === 'ENOENT') {
          throw almError({ keyName: 'invalidPath', bundle: 'mdapiConvertApi' });
        } else {
          throw err;
        }
      });
  }
}

export = MdapiConvertApi;

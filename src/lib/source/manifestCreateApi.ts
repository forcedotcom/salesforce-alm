/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

// Thirdparty
import * as optional from 'optional-js';
import * as BBPromise from 'bluebird';
import * as xml2js from 'xml2js';
import * as _ from 'lodash';

// Local
import MetadataRegistry = require('./metadataRegistry');
import { MetadataTypeFactory } from './metadataTypeFactory';
import logApi = require('../core/logApi');
import * as almError from '../core/almError';

// Promisify
const fsStat = BBPromise.promisify(fs.stat);
const fsWriteFile = BBPromise.promisify(fs.writeFile);
const fsReaddir = BBPromise.promisify(fs.readdir);
const fsMkdir = BBPromise.promisify(fs.mkdir);

function createOutputXmlManifestFile(fileName, packageManifestJson) {
  const xmlBuilder = new xml2js.Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  });
  const xml = xmlBuilder.buildObject(packageManifestJson);
  return fsWriteFile(fileName, xml).then(() => ({
    file: fileName,
    manifest: packageManifestJson
  }));
}

function generateMetadataManifestJson(packageName, typesAsKeyValuePairsArray, apiVersion) {
  const MdapiPackage = require('./mdapiPackage'); // eslint-disable-line global-require

  const mdPackage = new MdapiPackage();

  mdPackage.setVersion(apiVersion);

  if (!util.isNullOrUndefined(packageName)) {
    mdPackage.setPackageName(packageName);
  }

  typesAsKeyValuePairsArray.forEach(typeNamePair => {
    mdPackage.addMember(typeNamePair.name, typeNamePair.type);
  });

  return mdPackage.getPackage();
}

function processMetadataFile(dir, file, childLogger, metadataRegistry) {
  const filePath = path.resolve(dir, file);
  const metadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(filePath, metadataRegistry);
  let fileInfo = null;
  if (metadataType) {
    const fullName = metadataType.getAggregateFullNameFromFilePath(filePath);
    if (!util.isNullOrUndefined(fullName)) {
      fileInfo = { type: metadataType.getMetadataName(), name: fullName };
    }
  }
  if (fileInfo === null) {
    childLogger.info(`WARNING: Error parsing metadata file.  Ignoring - ${filePath}`);
  }
  return BBPromise.resolve(fileInfo);
}

function readMetadataDirectoryContent(dir) {
  return fsReaddir(dir)
    .then(files =>
      BBPromise.map(files, file =>
        fsStat(path.resolve(dir, file)).then(stats => ({
          name: file,
          isDirectory: stats.isDirectory()
        }))
      )
    )
    .then(fileInfoArray => {
      const dirContent = { metadataFiles: [], dirs: [] };
      fileInfoArray.forEach(fileInfo => {
        if (fileInfo.isDirectory) {
          dirContent.dirs.push(fileInfo.name);
        } else if (fileInfo.name.endsWith(MetadataRegistry.getMetadataFileExt())) {
          dirContent.metadataFiles.push(fileInfo.name);
        }
      });
      return dirContent;
    });
}

function processMetadataDirectory(dir, childLogger, metadataRegistry, manifestcreate?) {
  return readMetadataDirectoryContent(dir)
    .then(entriesToBeProcessed =>
      BBPromise.map(entriesToBeProcessed.metadataFiles, file =>
        processMetadataFile(dir, file, childLogger, metadataRegistry)
      ).then(resultFromFiles =>
        BBPromise.all([
          resultFromFiles,
          BBPromise.map(entriesToBeProcessed.dirs, childDir =>
            processMetadataDirectory(path.resolve(dir, childDir), childLogger, metadataRegistry, manifestcreate)
          )
        ])
      )
    )
    .then(resultAsKeyValuePairs => {
      // Flatten result from previous step which contains multi-level arrays due
      // to the way promise combines results from files in current directory and files
      // in child directory.
      const elementsToProcess = [];
      const flattenedResultObj = [];
      elementsToProcess.push(resultAsKeyValuePairs);
      while (elementsToProcess.length > 0) {
        const nextElement = elementsToProcess[0];
        if (Array.isArray(nextElement)) {
          if (nextElement.length > 0) {
            for (const element of nextElement) {
              if (element) {
                elementsToProcess.push(element);
              }
            }
          }
        } else if (nextElement) {
          flattenedResultObj.push(nextElement);
        }
        elementsToProcess.shift();
      }
      return flattenedResultObj;
    });
}

/**
 * API object to create manifest file.
 *
 * @constructor
 */
const manifestCreate = function(org, beforeManifestGenerationHook?) {
  this.org = org;
  this.config = this.org.config;
  this.apiVersion = this.config.getApiVersion();
  this.logger = logApi.child('manifest-create');
  this._fsStat = fsStat;
  this._fsMkdir = fsMkdir;
  this.beforeManifestGenerationHook = beforeManifestGenerationHook;
};

manifestCreate.prototype.execute = function execute(context) {
  const projectDirectory = this.config.getProjectPath();
  const appConfig = this.config.getAppConfig();
  // use defaultArtifact which is root dir of source (if set, prepend project dir)
  const defaultSourceDirectory = !util.isNullOrUndefined(appConfig.defaultPackagePath)
    ? path.join(projectDirectory, appConfig.defaultPackagePath)
    : projectDirectory;
  const rootDirectory = optional.ofNullable(context.sourcedir).orElse(defaultSourceDirectory);
  this.outputDirectory = optional.ofNullable(context.outputdir).orElse(projectDirectory);
  const outputFile = path.resolve(this.outputDirectory, 'package.xml');
  const apiVersion = this.apiVersion;
  const orgApi = this.org;

  return this._validateDirectory(rootDirectory, almError('InvalidArgumentDirectoryPath', ['sourcedir', rootDirectory]))
    .then(() => this._createDirIfNotExists(this.outputDirectory))
    .then(() =>
      this._validateDirectory(
        this.outputDirectory,
        almError('InvalidArgumentDirectoryPath', ['outputdir', this.outputDirectory])
      )
    )
    .then(() => MetadataRegistry.initializeMetadataTypeInfos(orgApi))
    .then(() => {
      this.metadataRegistry = new MetadataRegistry(orgApi);
      return processMetadataDirectory(rootDirectory, this.logger, this.metadataRegistry);
    })
    .then(resultAsKeyValuePairs => {
      if (this.beforeManifestGenerationHook) {
        resultAsKeyValuePairs = this.beforeManifestGenerationHook(resultAsKeyValuePairs);
      }
      if (context.exclusions) {
        resultAsKeyValuePairs = resultAsKeyValuePairs.filter(element =>
          _.isNil(
            context.exclusions.find(exclusion => exclusion.type === element.type && exclusion.name === element.name)
          )
        );
      }
      const packageManifestJson = generateMetadataManifestJson(context.packageName, resultAsKeyValuePairs, apiVersion);
      return createOutputXmlManifestFile(outputFile, packageManifestJson);
    });
};

manifestCreate.prototype.createManifest = function(context, packageName, typeFullNamePairs) {
  const outputDir = optional.ofNullable(context.outputdir).orElse(this.config.getProjectPath());
  const outputFile = path.resolve(outputDir, optional.ofNullable(context.outputfile).orElse('package.xml'));
  const sourceApiVersion = !util.isNullOrUndefined(context.sourceApiVersion)
    ? context.sourceApiVersion
    : this.apiVersion;
  const packageManifestJson = generateMetadataManifestJson(packageName, typeFullNamePairs, sourceApiVersion);
  return createOutputXmlManifestFile(outputFile, packageManifestJson);
};

/**
 * Creates an mdapi compatible package.xml manifest from an mdapiPackage
 * @param {object} context - looking for context.outputdir; location for writing the package.xml
 * @param {object} mdapiPackage - The mdapi package
 */
manifestCreate.prototype.createManifestForMdapiPackage = function(context, mdapiPackage, metadataRegistry) {
  const outputFile = path.resolve(
    optional.ofNullable(context.outputdir).orElse(this.config.getProjectPath()),
    'package.xml'
  );
  return createOutputXmlManifestFile(outputFile, mdapiPackage.getPackage(metadataRegistry));
};

manifestCreate.prototype._validateDirectory = function(dir, failWithErr) {
  return this._fsStat(dir)
    .then(dirStats => {
      if (!dirStats.isDirectory()) {
        return BBPromise.reject(failWithErr);
      }
      return BBPromise.resolve();
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        return BBPromise.reject(almError('PathDoesNotExist', dir));
      }
      return BBPromise.reject(err);
    });
};

manifestCreate.prototype._createDirIfNotExists = function(dir) {
  return this._fsStat(dir)
    .then(() => {})
    .catch(err => {
      if (err.code === 'ENOENT') {
        return this._fsMkdir(dir);
      }
      return BBPromise.reject(err);
    });
};

export = manifestCreate;

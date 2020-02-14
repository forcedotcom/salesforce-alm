/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { DefaultMetadataType } from './defaultMetadataType';
import * as PathUtil from '../sourcePathUtil';

import MetadataRegistry = require('../metadataRegistry');

const territory2ModelDefaultDir = 'territory2Models'; // This should not need to be hardcoded when the MetadataRegistry becomes static

export class Territory2AndTerritory2RuleMetadataType extends DefaultMetadataType {
  getFullNameFromFilePath(filePath: string): string {
    return this.getAggregateFullNameFromFilePath(filePath);
  }

  getAggregateFullNameFromFilePath(filePath: string): string {
    const modelName = PathUtil.getGrandparentDirectoryName(filePath);
    const territoryName = PathUtil.getFileName(filePath);
    //need to check modelName for a windows specific issue
    return modelName === 'undefined' ? territoryName : `${modelName}.${territoryName}`;
  }

  getDefaultAggregateMetadataPath(fullName: string, defaultSourceDir: string, bundleFileProperties): string {
    const nameParts = fullName.split('.');
    const modelName = nameParts[0];
    const fileName = `${nameParts[1]}.${this.typeDefObj.ext}${MetadataRegistry.getMetadataFileExt()}`;
    if (modelName === 'undefined') {
      return path.join(defaultSourceDir, territory2ModelDefaultDir, `${this.typeDefObj.defaultDirectory}`, fileName);
    }
    return path.join(
      defaultSourceDir,
      territory2ModelDefaultDir,
      modelName,
      `${this.typeDefObj.defaultDirectory}`,
      fileName
    );
  }

  protected getPathToMdapiSourceDir(aggregateFullName: string, mdDir: string): string {
    return path.join(
      mdDir,
      territory2ModelDefaultDir,
      aggregateFullName.split('.')[0],
      this.typeDefObj.defaultDirectory
    );
  }

  getAggregateFullNameFromFileProperty(fileProperty, namespace: string): string {
    if (fileProperty.fullName) {
      return fileProperty.fullName;
    }
    // In the case of mdapiPull, the mdapi does not return a fullName in the fileProperty for
    // territory2Rule and territory2 entities. In this case, generate it from the fileName.
    const filePropertyFileName = PathUtil.replaceForwardSlashes(fileProperty.fileName);
    const modelName = filePropertyFileName.split(path.sep)[2];
    const name = path.basename(filePropertyFileName).split('.')[0];
    return modelName === 'undefined' ? name : `${modelName}.${name}`;
  }

  getAggregateFullNameFromMdapiPackagePath(mdapiPackagePath: string): string {
    const pathElements = mdapiPackagePath.split(path.sep);
    if (pathElements.length === 4) {
      const modelName = pathElements[pathElements.length - 3];
      const ruleOrTerritoryName = PathUtil.getFileName(pathElements[pathElements.length - 1]);
      return modelName === 'undefined' ? ruleOrTerritoryName : `${modelName}.${ruleOrTerritoryName}`;
    }
    return null;
  }
}

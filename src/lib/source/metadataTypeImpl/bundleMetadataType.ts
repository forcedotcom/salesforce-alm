/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import { DefaultMetadataType } from './defaultMetadataType';
import { TypeDefObj } from '../typeDefObj';
import * as PathUtil from '../sourcePathUtil';
import { BundlePathHelper } from '../bundlePathHelper';

export class BundleMetadataType extends DefaultMetadataType {
  constructor(typeDefObj: TypeDefObj) {
    super(typeDefObj);
  }

  getFullNameFromFilePath(filePath: string): string {
    return BundlePathHelper.buildFullNameFromFilePath(filePath, this.typeDefObj.defaultDirectory);
  }

  getAggregateFullNameFromFilePath(filePath: string): string {
    return BundlePathHelper.scanFilePathForAggregateFullName(filePath, this.typeDefObj.defaultDirectory);
  }

  getAggregateFullNameFromMdapiPackagePath(mdapiPackagePath: string): string {
    return PathUtil.getParentDirectoryName(mdapiPackagePath);
  }

  getAggregateMetadataFilePathFromWorkspacePath(filePath) {
    return BundlePathHelper.findMetadataFilePathInBundleDir(filePath, this.typeDefObj.defaultDirectory);
  }

  getDefaultAggregateMetadataPath(fullName: string, defaultSourceDir: string, bundleFileProperties) {
    return BundlePathHelper.getPathFromBundleTypeFileProperties(
      fullName,
      defaultSourceDir,
      this.typeDefObj.defaultDirectory,
      bundleFileProperties
    );
  }

  getAggregateFullNameFromSourceMemberName(sourceMemberName: string): string {
    return sourceMemberName.split(path.sep)[0];
  }

  getAggregateFullNameFromWorkspaceFullName(workspaceFullName: string): string {
    return workspaceFullName.split(path.sep)[0];
  }

  getAggregateFullNameFromFileProperty(fileProperty, namespace: string): string {
    return fileProperty.fullName.split(path.sep)[0];
  }

  protected getPathToMdapiSourceDir(aggregateFullName: string, mdDir: string): string {
    return path.join(mdDir, this.typeDefObj.defaultDirectory, aggregateFullName);
  }

  getOriginContentPathsForSourceConvert(
    metadataFilePath: string,
    workspaceVersion: string,
    unsupportedMimeTypes: string[],
    forceIgnore
  ): Promise<string[]> {
    const bundleDirPath = path.dirname(metadataFilePath);
    return Promise.resolve(BundlePathHelper.getAllNestedBundleContentPaths(bundleDirPath, forceIgnore));
  }

  // E.g. for a bundle with fullname=testbundle and an error in the helper the MD API response will contain:
  // "fileName": "metadataPackage_1497651865666/aura/testbundle/testbundleHelper.jss",
  // "fullName": "testbundle",
  getAggregateFullNameFromComponentFailure(componentFailure): string {
    return this.getAggregateFullNameFromFilePath(componentFailure.fileName);
  }

  getWorkspaceFullNameFromComponentFailure(componentFailure): string {
    return this.getFullNameFromFilePath(componentFailure.fileName);
  }

  handleSlashesForSourceMemberName(sourceMemberFullName: string): string {
    return PathUtil.replaceForwardSlashes(sourceMemberFullName);
  }

  sourceMemberFullNameCorrespondsWithWorkspaceFullName(
    sourceMemberFullName: string,
    workspaceFullName: string
  ): boolean {
    return sourceMemberFullName === workspaceFullName;
  }

  isDefinitionFile(filePath, metadataRegistry): boolean {
    // default implementation just returns false
    return false;
  }

  static getDefinitionProperties(fileProperties, metadataRegistry) {
    const { MetadataTypeFactory } = require('../metadataTypeFactory');
    return fileProperties
      .filter(fileProperty => {
        const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(fileProperty.type, metadataRegistry);
        if (metadataType instanceof BundleMetadataType) {
          return metadataType.isDefinitionFile(fileProperty.fileName, metadataRegistry);
        }
        return false;
      })
      .map(fileProperty => {
        fileProperty.fullName = PathUtil.replaceForwardSlashes(fileProperty.fullName);
        fileProperty.fileName = PathUtil.replaceForwardSlashes(fileProperty.fileName);
        return fileProperty;
      });
  }
}

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

export class InFolderMetadataType extends DefaultMetadataType {
  getFullNameFromFilePath(filePath: string): string {
    return this.getAggregateFullNameFromFilePath(filePath);
  }

  /** Returns the relative path of the metadata file starting after the metatadata type folder
   * @param filePath
   */
  getAggregateFullNameFromFilePath(filePath: string): string {
    const filepathArr = filePath.split(path.sep);
    const startIndex = filepathArr.lastIndexOf(this.typeDefObj.defaultDirectory) + 1;
    const parentFolder = filepathArr.slice(startIndex, filepathArr.length - 1).join(path.sep);
    const fileName = PathUtil.getFileName(filePath);
    return path.join(parentFolder, fileName);
  }

  /** Returns the complete path of the file including the workspace path
   * @param fullName
   * @param defaultSourceDir
   */
  getDefaultAggregateMetadataPath(fullName: string, defaultSourceDir: string, bundleFileProperties): string {
    const fullFileNameWithExtension = `${fullName}.${this.typeDefObj.ext}${MetadataRegistry.getMetadataFileExt()}`;
    return path.join(defaultSourceDir, this.typeDefObj.defaultDirectory, fullFileNameWithExtension);
  }

  /** Returns the source directory path till the folder of the metatdata file
   * @param aggregateFullName
   * @param mdDir
   */
  protected getPathToMdapiSourceDir(aggregateFullName: string, mdDir: string): string {
    const aggregateFullNameArr = aggregateFullName.split(path.sep);
    const parentFolder = aggregateFullNameArr.slice(0, aggregateFullNameArr.length - 1).join(path.sep);
    return path.join(mdDir, this.typeDefObj.defaultDirectory, parentFolder);
  }

  /**Returns the path of the metadata file starting from the metadata type folder.
   * @param mdapiPackagePath
   */
  getAggregateFullNameFromMdapiPackagePath(mdapiPackagePath: string): string {
    const pathElements = mdapiPackagePath.split(path.sep);
    const fullName = pathElements.slice(1, pathElements.length - 1).join(path.sep);
    const fileName = PathUtil.getFileName(mdapiPackagePath);
    return path.join(fullName, fileName);
  }

  getAggregateFullNameFromSourceMemberName(sourceMemberName: string): string {
    return sourceMemberName;
  }

  sourceMemberFullNameCorrespondsWithWorkspaceFullName(
    sourceMemberFullName: string,
    workspaceFullName: string
  ): boolean {
    return sourceMemberFullName === workspaceFullName;
  }

  handleSlashesForSourceMemberName(sourceMemberFullName: string): string {
    return PathUtil.replaceForwardSlashes(sourceMemberFullName);
  }
}

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import * as PathUtil from '../sourcePathUtil';
import MetadataRegistry = require('../metadataRegistry');
import { DefaultMetadataType } from './defaultMetadataType';

export class InFolderMetadataType extends DefaultMetadataType {
  getFullNameFromFilePath(filePath: string): string {
    return this.getAggregateFullNameFromFilePath(filePath);
  }

  /** Returns the relative path of the metadata file starting after the metatadata type folder
   *
   * @param filePath
   */
  getAggregateFullNameFromFilePath(filePath: string): string {
    const normalizedFilePath = path.normalize(filePath);
    const filepathArr = normalizedFilePath.split(path.sep);
    const startIndex = filepathArr.lastIndexOf(this.typeDefObj.defaultDirectory) + 1;
    const parentFolder = filepathArr.slice(startIndex, filepathArr.length - 1).join(path.sep);
    const fileName = PathUtil.getFileName(filePath);
    return path.join(parentFolder, fileName);
  }

  /** Returns the complete path of the file including the workspace path
   *
   * @param fullName
   * @param defaultSourceDir
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDefaultAggregateMetadataPath(fullName: string, defaultSourceDir: string, bundleFileProperties): string {
    const fullFileNameWithExtension = `${fullName}.${this.typeDefObj.ext}${MetadataRegistry.getMetadataFileExt()}`;
    return path.join(defaultSourceDir, this.typeDefObj.defaultDirectory, fullFileNameWithExtension);
  }

  /** Returns the source directory path till the folder of the metatdata file
   *
   * @param aggregateFullName
   * @param mdDir
   */
  protected getPathToMdapiSourceDir(aggregateFullName: string, mdDir: string): string {
    const aggregateFullNameArr = aggregateFullName.split(path.sep);
    const parentFolder = aggregateFullNameArr.slice(0, aggregateFullNameArr.length - 1).join(path.sep);
    return path.join(mdDir, this.typeDefObj.defaultDirectory, parentFolder);
  }

  /** Returns the path of the metadata file starting from the metadata type folder.
   *
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

  /**
   * Returns the base metadata type name for InFolder types, which is useful when matching
   * type/name pairs (e.g., from a manifest) to AggregateSourceElements.  The only non-
   * conforming InFolder type is EmailTemplate, so this is really just to support that type.
   *   Examples:
   *     Document --> Document
   *     EmailTemplate --> Email
   *     Report --> Report
   *     Dashboard --> Dashboard
   */
  getBaseTypeName(): string {
    // split a string on capital letters and return the first entry
    return this.getMetadataName().split(/(?=[A-Z])/)[0];
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

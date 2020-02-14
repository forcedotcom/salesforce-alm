/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import MetadataRegistry = require('../metadataRegistry');
import srcDevUtil = require('../../core/srcDevUtil');
import * as sourceState from '../sourceState';
import * as PathUtil from '../sourcePathUtil';

import { DefaultMetadataType } from './defaultMetadataType';
import { WorkspaceElement } from '../workspaceElement';

export class FolderMetadataType extends DefaultMetadataType {
  /**Return the path of the metadata file excluding the metadatatype folder. It also appends the metadata file extension : -meta.xml
   * @param metadataFilePath - The full path of the metadata file including the workspace  and the metadatatype extension. eg : projectPath/force-app/main/default/reports/Parent/child.reportFolder-meta.xml
   * Returns : Parent/child-meta.xml
   */
  protected getMdapiFormattedMetadataFileName(metadataFilePath: string): string {
    const filepathArr = metadataFilePath.split(path.sep);
    const startIndex = filepathArr.lastIndexOf(this.typeDefObj.defaultDirectory) + 1;
    const parentFolder = filepathArr.slice(startIndex, filepathArr.length - 1).join(path.sep);
    const fileName = `${path.basename(metadataFilePath).split('.')[0]}${MetadataRegistry.getMetadataFileExt()}`;
    return path.join(parentFolder, fileName);
  }

  /** Returns the relative path of the metadata file excluding the metatadata type folder
   * @param filePath - the path to report folder including the workspace path.eg: projectPath/force-app/main/default/reports/Parent/Child.reportFolder-meta.xml
   * returns : Parent/Child
   */
  getAggregateFullNameFromFilePath(filePath: string): string {
    const filepathArr = filePath.split(path.sep);
    const startIndex = filepathArr.lastIndexOf(this.typeDefObj.defaultDirectory) + 1;
    const parentFolder = filepathArr.slice(startIndex, filepathArr.length - 1).join(path.sep);
    const fileName = PathUtil.getFileName(filePath);
    return path.join(parentFolder, fileName);
  }

  /** Returns the path of the folder provided for metadata conversion, eg : Users/test/projectName/path provided for MDAPI conversion.
   * @param retrieveRoot
   * @param fileProperty
   */
  getRetrievedMetadataPath(fileProperty, retrieveRoot: string, bundleFileProperties): string {
    let fileName: string;
    if (fileProperty.fileName.endsWith(MetadataRegistry.getMetadataFileExt())) {
      fileName = fileProperty.fileName;
    } else {
      fileName = `${fileProperty.fileName}${MetadataRegistry.getMetadataFileExt()}`;
    }
    const retrievedMetadataPath = path.join(retrieveRoot, fileName);
    return this.validateRetrievedMetadataPathExists(retrievedMetadataPath);
  }

  /** Returns the path of the folder excluding the metadatatype
   * @param mdapiPackagePath - includes the path from the metadatype to the folder.eg : reports/ParentFolder/childFolder, returns : ParentFolder/childFolder
   */
  getAggregateFullNameFromMdapiPackagePath(mdapiPackagePath: string): string {
    const pathElements = mdapiPackagePath.split(path.sep);
    const fullName = pathElements.slice(1, pathElements.length - 1).join(path.sep);
    const fileName = PathUtil.getFileName(mdapiPackagePath);
    return path.join(fullName, fileName);
  }

  static createEmptyFolder(workspaceElements: WorkspaceElement[], metadataFilePath: string, ext: string): string {
    if (FolderMetadataType.isCreatingNewFolder(workspaceElements, metadataFilePath)) {
      const folderExtensionIndex = metadataFilePath.indexOf(`.${ext}${MetadataRegistry.getMetadataFileExt()}`);
      const folderPath = metadataFilePath.substring(0, folderExtensionIndex);
      if (!srcDevUtil.pathExistsSync(folderPath)) {
        srcDevUtil.ensureDirectoryExistsSync(folderPath);
        return folderPath;
      }
    }
    return null;
  }

  /**
   * Returns true if a new folder type is being created; false if a folder type is being deleted or changed
   * @param workspaceElements
   * @param {string} metadataFilePath
   * @returns {boolean}
   */
  private static isCreatingNewFolder(workspaceElements: WorkspaceElement[], metadataFilePath: string): boolean {
    const metadataFileElement = workspaceElements.find(
      workspaceElement => workspaceElement.getSourcePath() === metadataFilePath
    );
    if (metadataFileElement) {
      return metadataFileElement.getState() === sourceState.NEW;
    }
    return false;
  }

  isFolderType(): boolean {
    return true;
  }
}

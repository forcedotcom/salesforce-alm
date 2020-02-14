/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as Debug from 'debug';

import { MetadataType } from '../metadataType';
import { TypeDefObj } from '../typeDefObj';
import { WorkspaceElement } from '../workspaceElement';
import * as PathUtil from '../sourcePathUtil';
import { DecompositionConfig } from '../decompositionStrategy/decompositionConfig';

import MetadataRegistry = require('../metadataRegistry');
import srcDevUtil = require('../../core/srcDevUtil');
import Messages = require('../../messages');
const messages = Messages();

/**
 * Default type obj is any atomic (non-decomposed) metadata type
 */
export class DefaultMetadataType implements MetadataType {
  protected typeDefObj: TypeDefObj;
  private _debug = Debug(`sfdx:${this.constructor.name}`);

  constructor(typeDefObj: TypeDefObj) {
    this.typeDefObj = typeDefObj;
  }

  getAggregateMetadataName(): string {
    return this.getMetadataName();
  }

  getMetadataName(): string {
    return this.typeDefObj.metadataName;
  }

  isAddressable(): boolean {
    return this.typeDefObj.isAddressable;
  }

  getDecompositionConfig(): DecompositionConfig {
    return this.typeDefObj.decompositionConfig;
  }

  resolveSourcePath(sourcePath: string): string {
    return sourcePath;
  }

  getFullNameFromFilePath(filePath: string): string {
    return PathUtil.getFileName(filePath);
  }

  getAggregateFullNameFromFilePath(filePath: string): string {
    return PathUtil.getFileName(filePath);
  }

  getAggregateMetadataFilePathFromWorkspacePath(filePath): string {
    return DefaultMetadataType.getPathWithMetadataExtension(filePath);
  }

  getDefaultAggregateMetadataPath(fullName: string, defaultSourceDir: string, bundleFileProperties): string {
    return this.getAggregateMetadataPathInDir(defaultSourceDir, fullName);
  }

  getAggregateMetadataPathInDir(dirName: string, fullName: string): string {
    const pathToDir = path.join(dirName, this.typeDefObj.defaultDirectory);
    const fileName = `${fullName}.${this.typeDefObj.ext}${MetadataRegistry.getMetadataFileExt()}`;
    return path.join(pathToDir, fileName);
  }

  getAggregateFullNameFromSourceMemberName(sourceMemberName: string): string {
    return PathUtil.encodeMetadataString(sourceMemberName);
  }

  getAggregateFullNameFromWorkspaceFullName(workspaceFullName: string): string {
    return workspaceFullName;
  }

  getAggregateFullNameFromFileProperty(fileProperty, namespace: string): string {
    return fileProperty.fullName;
  }

  getMdapiMetadataPath(metadataFilePath: string, aggregateFullName: string, mdDir: string): string {
    const mdapiSourceDir = this.getPathToMdapiSourceDir(aggregateFullName, mdDir);
    const mdapiMetadataFileName = this.getMdapiFormattedMetadataFileName(metadataFilePath);
    return path.join(mdapiSourceDir, mdapiMetadataFileName);
  }

  protected getPathToMdapiSourceDir(aggregateFullName: string, mdDir: string): string {
    return path.join(mdDir, this.typeDefObj.defaultDirectory);
  }

  private static getPathWithMetadataExtension(filePath: string): string {
    if (!filePath.endsWith(MetadataRegistry.getMetadataFileExt())) {
      return `${filePath}${MetadataRegistry.getMetadataFileExt()}`;
    }
    return filePath;
  }

  protected getMdapiFormattedMetadataFileName(metadataFilePath: string): string {
    const fileName = path.basename(metadataFilePath);
    if (!this.typeDefObj.hasContent) {
      return PathUtil.removeMetadataFileExtFrom(fileName);
    }
    return fileName;
  }

  hasIndividuallyAddressableChildWorkspaceElements(): boolean {
    return false;
  }

  requiresIndividuallyAddressableMembersInPackage(): boolean {
    return false;
  }

  isStandardMember(workspaceFullName: string): boolean {
    return this.typeDefObj.hasStandardMembers && !workspaceFullName.includes('__');
  }

  getWorkspaceElementsToDelete(aggregateMetadataPath: string, fileProperty): WorkspaceElement[] {
    return [];
  }

  getRetrievedMetadataPath(fileProperty, retrieveRoot: string, bundlefileProperties): string {
    const retrievedMetadataPath = this.getRetrievedMetadataPathFromFileProperty(fileProperty, retrieveRoot);
    return this.validateRetrievedMetadataPathExists(retrievedMetadataPath);
  }

  protected validateRetrievedMetadataPathExists(retrievedMetadataPath: string): string {
    if (srcDevUtil.pathExistsSync(retrievedMetadataPath)) {
      return retrievedMetadataPath;
    } else {
      const err = new Error();
      err['name'] = 'Missing metadata file';
      err['message'] = messages.getMessage('MissingMetadataFile', retrievedMetadataPath);
      throw err;
    }
  }

  protected getRetrievedMetadataPathFromFileProperty(fileProperty, retrieveRoot: string): string {
    let fileName = fileProperty.fileName;
    if (this.typeDefObj.hasContent) {
      fileName = `${fileName}${MetadataRegistry.getMetadataFileExt()}`;
    }
    return path.join(retrieveRoot, fileName);
  }

  getRetrievedContentPath(fileProperty, retrieveRoot: string): string {
    if (this.typeDefObj.hasContent) {
      const retrievedContentPath = path.join(retrieveRoot, fileProperty.fileName);
      if (srcDevUtil.pathExistsSync(retrievedContentPath)) {
        return retrievedContentPath;
      }
    }
    return null;
  }

  getWorkspaceContentFilePath(metadataFilePath, retrievedContentFilePath): string {
    const workspaceDir = path.dirname(metadataFilePath);
    const fileName = path.basename(retrievedContentFilePath);
    return path.join(workspaceDir, fileName);
  }

  getOriginContentPathsForSourceConvert(
    metadataFilePath: string,
    workspaceVersion: string,
    unsupportedMimeTypes: string[],
    forceIgnore
  ): Promise<string[]> {
    return Promise.resolve([metadataFilePath.replace(MetadataRegistry.getMetadataFileExt(), '')]);
  }

  getMdapiContentPathForSourceConvert(originContentPath: string, aggregateFullName: string, mdDir: string): string {
    const mdapiSourceDir = this.getPathToMdapiSourceDir(aggregateFullName, mdDir);
    const mdapiContentFileName = this.getMdapiFormattedContentFileName(originContentPath, aggregateFullName);
    return this.getMdapiFormattedContentPath(mdapiSourceDir, mdapiContentFileName);
  }

  protected getMdapiFormattedContentPath(mdapiSourceDir: string, contentFileName: string): string {
    return path.join(mdapiSourceDir, contentFileName);
  }

  protected getMdapiFormattedContentFileName(originContentPath: string, aggregateFullName: string): string {
    return path.basename(originContentPath);
  }

  isFolderType(): boolean {
    return false;
  }

  /**
   * @param {string} metadataFilePath
   * @returns {boolean}
   */
  mainContentFileExists(metadataFilePath: string): boolean {
    const contentFilePath = PathUtil.removeMetadataFileExtFrom(metadataFilePath);
    return srcDevUtil.pathExistsSync(contentFilePath);
  }

  displayAggregateRemoteChangesOnly(): boolean {
    return false;
  }

  getExt(): string {
    return this.typeDefObj.ext;
  }

  sourceMemberFullNameCorrespondsWithWorkspaceFullName(
    sourceMemberFullName: string,
    workspaceFullName: string
  ): boolean {
    return PathUtil.encodeMetadataString(sourceMemberFullName) === workspaceFullName;
  }

  protected sourceMemberFullNameConflictsWithWorkspaceFullName(
    sourceMemberFullName: string,
    workspaceFullName: string
  ): boolean {
    return sourceMemberFullName === workspaceFullName;
  }

  handleSlashesForSourceMemberName(sourceMemberFullName: string): string {
    return sourceMemberFullName;
  }

  conflictDetected(remoteChangeType: string, remoteChangeFullName: string, workspaceFullName: string): boolean {
    return (
      this.sourceMemberFullNameConflictsWithWorkspaceFullName(remoteChangeFullName, workspaceFullName) &&
      remoteChangeType === this.typeDefObj.metadataName
    );
  }

  trackRemoteChangeForSourceMemberName(sourceMemberName: string): boolean {
    return true;
  }

  onlyDisplayOneConflictPerAggregate(): boolean {
    return false;
  }

  getDisplayPathForLocalConflict(workspaceFilePath: string): string {
    return workspaceFilePath;
  }

  hasContent(): boolean {
    return this.typeDefObj.hasContent;
  }

  getAggregateFullNameFromComponentFailure(componentFailure): string {
    return componentFailure.fullName;
  }

  getAggregateFullNameFromMdapiPackagePath(mdapiPackagePath: string): string {
    return PathUtil.getFileName(mdapiPackagePath);
  }

  getDisplayNameForRemoteChange(sourceMemberType: string): string {
    return this.typeDefObj.metadataName;
  }

  deleteSupported(workspaceFullName: string): boolean {
    return this.typeDefObj.deleteSupported && !this.isStandardMember(workspaceFullName);
  }

  getChildMetadataTypes(): string[] {
    if (this.typeDefObj.childXmlNames) {
      return this.typeDefObj.childXmlNames;
    }
    return [];
  }

  entityExistsInWorkspace(metadataFilePath: string): boolean {
    return fs.existsSync(metadataFilePath);
  }

  validateDeletedContentPath(deletedContentPath: string, contentPaths: string[], metadataRegistry): void {
    return;
  }

  isContentPath(sourcePath: string): boolean {
    return this.typeDefObj.hasContent && !sourcePath.endsWith(MetadataRegistry.getMetadataFileExt());
  }

  getComponentFailureWorkspaceContentPath(metadataFilePath: string, workspaceContentPaths: string[]): string {
    return workspaceContentPaths[0];
  }

  getWorkspaceFullNameFromComponentFailure(componentFailure): string {
    return this.getAggregateFullNameFromComponentFailure(componentFailure);
  }

  getDeprecationMessage(fullName?: string): string {
    return;
  }

  componentFailureIsInMetadataFile(componentFileName: string): boolean {
    return componentFileName.endsWith(MetadataRegistry.getMetadataFileExt()) || !this.typeDefObj.hasContent;
  }

  parseSourceMemberForMetadataRetrieve(
    sourceMemberName: string,
    sourceMemberType: string,
    isNameObsolete: boolean
  ): any {
    return {
      fullName: sourceMemberName,
      type: sourceMemberType,
      isNameObsolete
    };
  }

  isContainerValid(container): boolean {
    return true;
  }

  shouldGetMetadataTranslation(): boolean {
    return true;
  }

  shouldDeleteWorkspaceAggregate(metadataType: string): boolean {
    return metadataType === this.getAggregateMetadataName();
  }

  protected debug(message: () => string) {
    if (this._debug.enabled) {
      this._debug(message());
    }
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as glob from 'glob';
import srcDevUtil = require('../../core/srcDevUtil');
import MetadataRegistry = require('../metadataRegistry');
import * as PathUtil from '../sourcePathUtil';
import { BundlePathHelper } from '../bundlePathHelper';
import { TypeDefObj } from '../typeDefObj';
import Messages = require('../../messages');
import { BundleMetadataType } from './bundleMetadataType';
const messages = Messages();

export class AuraDefinitionBundleMetadataType extends BundleMetadataType {
  constructor(typeDefObj: TypeDefObj) {
    super(typeDefObj);
  }

  // Override
  getFullNameFromFilePath(filePath: string): string {
    const bundleName = PathUtil.getParentDirectoryName(filePath);
    const fileName = PathUtil.removeMetadataFileExtFrom(path.basename(filePath));
    return path.join(bundleName, fileName);
  }

  // Override
  getAggregateFullNameFromFilePath(filePath: string): string {
    return PathUtil.getParentDirectoryName(filePath);
  }

  getRetrievedMetadataPath(fileProperty, retrieveRoot: string, bundleFileProperties): string {
    const bundlePath = path.dirname(fileProperty.fileName);
    const fileName = BundlePathHelper.getMetadataFileNameFromBundleFileProperties(
      fileProperty.fullName,
      bundleFileProperties
    );
    const retrievedMetadataPath = path.join(retrieveRoot, bundlePath, fileName);
    if (srcDevUtil.pathExistsSync(retrievedMetadataPath)) {
      return retrievedMetadataPath;
    }
    return null;
    // W-3903546 older AuraDefinitionBundles do not require a -meta.xml file
  }

  // Override
  getOriginContentPathsForSourceConvert(
    metadataFilePath: string,
    workspaceVersion: string,
    unsupportedMimeTypes: string[],
    forceIgnore
  ): Promise<string[]> {
    const bundleDirPath = path.dirname(metadataFilePath);
    const bundlePaths = glob.sync(path.join(bundleDirPath, '*'));
    return Promise.resolve(
      bundlePaths.filter(
        bundlePath => forceIgnore.accepts(bundlePath) && !bundlePath.endsWith(MetadataRegistry.getMetadataFileExt())
      )
    );
  }

  protected sourceMemberFullNameConflictsWithWorkspaceFullName(
    sourceMemberFullName: string,
    workspaceFullName: string
  ): boolean {
    const aggregateSourceMemberName = this.getAggregateFullNameFromSourceMemberName(sourceMemberFullName);
    const aggregateFullName = this.getAggregateFullNameFromWorkspaceFullName(workspaceFullName);
    return aggregateSourceMemberName === aggregateFullName;
  }

  trackRemoteChangeForSourceMemberName(sourceMemberName: string): boolean {
    // Whenever a component of an AuraBundle is modified in the scratch org, a SourceMember is created
    // at the bundle level and another is created for the changed component. Ignore the SourceMember created
    // for the bundle and track specific bundle component changes only.
    return sourceMemberName.split(path.sep).length > 1;
  }

  onlyDisplayOneConflictPerAggregate(): boolean {
    // Waiting on W-4389673 to support fine-grained push and pull of AuraDefinitionBundle components
    // Until they are supported, we only want to report one conflict entry per bundle
    return true;
  }

  getDisplayPathForLocalConflict(workspaceFilePath: string): string {
    return path.dirname(workspaceFilePath);
  }

  getAggregateFullNameFromMdapiPackagePath(mdapiPackagePath: string): string {
    const pathElements = mdapiPackagePath.split(path.sep);
    return pathElements[1];
  }

  validateDeletedContentPath(deletedContentPath: string, contentPaths: string[], metadataRegistry): void {
    // For Aura Bundles, if we are deleting the metadata file, but there are still other aura definitions present, we should throw an error
    const auraTypeDef = metadataRegistry.getLightningDefByFileName(deletedContentPath);
    if (auraTypeDef && auraTypeDef.hasMetadata) {
      const otherAuraFilesExist = contentPaths.some(contentPath => !contentPath.endsWith(auraTypeDef.fileSuffix));
      if (otherAuraFilesExist) {
        const err = new Error();
        err['message'] = messages.getMessage('MissingContentFile', deletedContentPath);
        err['name'] = 'Missing Content File';
        throw err;
      }
    }
  }

  parseSourceMemberForMetadataRetrieve(
    sourceMemberName: string,
    sourceMemberType: string,
    isNameObsolete: boolean
  ): any {
    sourceMemberName = PathUtil.replaceForwardSlashes(sourceMemberName);
    return {
      fullName: sourceMemberName,
      type: sourceMemberType,
      isNameObsolete
    };
  }

  /**
   * Returns the fileProperty object for the Aura definition metadata file corresponding to the given filePropertyFileName
   * @param retrieveRoot
   * @param filePropertyFileName
   * @returns {any}
   */
  static getCorrespondingAuraDefinitionFileProperty(
    retrieveRoot: string,
    filePropertyFileName: string,
    auraMetadataName: string,
    metadataRegistry
  ): any {
    const bundleDirPath = path.join(retrieveRoot, path.dirname(filePropertyFileName));
    const bundlePaths = glob.sync(path.join(bundleDirPath, '*'));
    const bundleDefinitionPath = bundlePaths.find(bundlePath =>
      AuraDefinitionBundleMetadataType.prototype.isDefinitionFile(bundlePath, metadataRegistry)
    );
    const auraDefinitionFileProperty = {
      type: auraMetadataName,
      fileName: path.relative(retrieveRoot, bundleDefinitionPath),
      fullName: path.basename(bundleDefinitionPath, path.extname(bundleDefinitionPath))
    };
    return auraDefinitionFileProperty;
  }

  isDefinitionFile(filePath, metadataRegistry): boolean {
    const lightningDefType = metadataRegistry.getLightningDefByFileName(filePath);
    if (lightningDefType) {
      const isDefinitionFile = lightningDefType.hasMetadata;
      return isDefinitionFile;
    }
    return false;
  }

  shouldDeleteWorkspaceAggregate(metadataType: string): boolean {
    // Handle deletes of AuraDefinitionBundles at the subcomponent level because
    // SourceMembers are created for each subcomponent
    return false;
  }
}

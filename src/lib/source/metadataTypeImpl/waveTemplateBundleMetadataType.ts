/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import { BundleMetadataType } from './bundleMetadataType';
import { TypeDefObj } from '../typeDefObj';
import { BundlePathHelper } from '../bundlePathHelper';
import * as PathUtil from '../sourcePathUtil';

import Messages = require('../../messages');
const messages = Messages();

//Required file to represent WaveTemplateBundles definitions
const waveTemplateBundleDefinitionFile = 'template-info.json';

export class WaveTemplateBundleMetadataType extends BundleMetadataType {
  constructor(typeDefObj: TypeDefObj) {
    super(typeDefObj);
  }

  // Override
  getAggregateMetadataFilePathFromWorkspacePath(filePath): string {
    // wave templates have no metadata file, so return the path to the bundle directory
    const bundleName = this.getAggregateFullNameFromFilePath(filePath);
    const pathToWaveTemplates = PathUtil.getPathToDir(filePath, this.typeDefObj.defaultDirectory);
    return path.join(pathToWaveTemplates, bundleName);
  }

  // Override
  getDefaultAggregateMetadataPath(fullName: string, defaultSourceDir: string, bundleFileProperties): string {
    // If there is a bundle properties, and there is always only 0 or 1 values here, then check for additional
    // path details to include between the bundleName and fileName.
    const bundle = bundleFileProperties[0];
    if (bundle) {
      const name = bundle.fileName;
      let baseFileName = path.basename(name);
      const additionalPath = BundlePathHelper.getExtendedBundlePath(name, fullName);
      if (additionalPath) {
        return path.join(defaultSourceDir, this.typeDefObj.defaultDirectory, fullName, additionalPath, baseFileName);
      } else {
        return path.join(defaultSourceDir, this.typeDefObj.defaultDirectory, fullName, baseFileName);
      }
    } else {
      return path.join(defaultSourceDir, this.typeDefObj.defaultDirectory, fullName);
    }
  }

  // Override
  getRetrievedMetadataPath(fileProperty, retrieveRoot: string, bundleFileProperties): string {
    // This sets aggregateSourceElement.retrievedMetadataPath in sourceWorkspaceAdapter
    // used for the convert command.  Return null as this is supposed to represent the meta-xml file.
    return null;
  }

  isDefinitionFile(filePath, metadataRegistry): boolean {
    // other bundle types have a file (.meta.xml file typically) that are used as a definition file.
    // For WaveTemplateBundle use the template-info.json file so this metadata is marked as a bundle
    const waveDefType = metadataRegistry.getWaveDefByFileName(filePath);
    if (waveDefType) {
      const fileName = path.basename(filePath);
      return fileName === waveTemplateBundleDefinitionFile;
    }
    return false;
  }

  // Override
  getOriginContentPathsForSourceConvert(
    metadataFilePath: string,
    workspaceVersion: string,
    unsupportedMimeTypes: string[],
    forceIgnore
  ): Promise<string[]> {
    // WaveTemplateBundles have no metadata files, so the metadataFilePath is the path to the bundle
    return Promise.resolve(BundlePathHelper.getAllNestedBundleContentPaths(metadataFilePath, forceIgnore));
  }

  shouldGetMetadataTranslation(): boolean {
    return false;
  }

  getWorkspaceContentFilePath(metadataFilePath, retrievedContentFilePath): string {
    const fileName = path.basename(retrievedContentFilePath);
    const bundleName = BundlePathHelper.scanFilePathForAggregateFullName(
      metadataFilePath,
      this.typeDefObj.defaultDirectory
    );
    const metadataDir = path.dirname(metadataFilePath);

    // If there is an additional path in the retrieved content then check if it's already included in the metadata path, and if
    // not add it.
    const additionalPath = BundlePathHelper.getExtendedBundlePath(retrievedContentFilePath, bundleName);
    if (additionalPath) {
      if (path.basename(metadataDir) !== path.basename(additionalPath)) {
        return path.join(metadataDir, additionalPath, fileName);
      }
    }
    return path.join(metadataDir, fileName);
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
    // Wave Templates only report changes in sourcemember at the bundle level
    return true;
  }

  onlyDisplayOneConflictPerAggregate(): boolean {
    // Wave Templates behave similar to aura bundles, following same logic
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
    const wtTypeDef = metadataRegistry.getWaveDefByFileName(deletedContentPath);
    if (wtTypeDef && wtTypeDef.hasMetadata) {
      const otherWaveTemplateFilesExist = contentPaths.some(contentPath => !contentPath.endsWith(wtTypeDef.fileSuffix));
      if (otherWaveTemplateFilesExist) {
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
    const fullName = this.getAggregateFullNameFromSourceMemberName(sourceMemberName);
    return { fullName, type: sourceMemberType, isNameObsolete };
  }

  protected getMdapiFormattedContentFileName(originContentPath: string, aggregateFullName: string): string {
    // WaveTemplateBundles bundles can have nested sub-directories.
    // In order to maintain the bundle structure in the mdapi formatted directory,
    // return the path from the bundle directory to the file
    const pathToBundle = PathUtil.getPathToDir(originContentPath, aggregateFullName);
    return path.relative(pathToBundle, originContentPath);
  }
}

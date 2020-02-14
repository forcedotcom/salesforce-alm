/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
const glob = require('glob');
import srcDevUtil = require('../../core/srcDevUtil');

import { BundleMetadataType } from './bundleMetadataType';
import { TypeDefObj } from '../typeDefObj';
import * as PathUtil from '../sourcePathUtil';
import { BundlePathHelper } from '../bundlePathHelper';

export class LightningComponentBundleMetadataType extends BundleMetadataType {
  constructor(typeDefObj: TypeDefObj) {
    super(typeDefObj);
  }

  protected getMdapiFormattedContentFileName(originContentPath: string, aggregateFullName: string): string {
    // LWC bundles can have nested sub-directories.
    // In order to maintain the bundle structure in the mdapi formatted directory,
    // return the path from the bundle directory to the file
    const pathArray: string[] = path.dirname(originContentPath).split(path.sep);
    const dirIndex = pathArray.lastIndexOf(aggregateFullName);
    const pathToBundle = pathArray.slice(0, dirIndex + 1).join(path.sep);
    return path.relative(pathToBundle, originContentPath);
  }

  // Given the LWC meta file path and the retrieved content file path within
  // the temporary directory, return the path to the associated file within
  // the project directory.
  getWorkspaceContentFilePath(metadataFilePath, retrievedContentFilePath): string {
    const bundlePath = path.dirname(metadataFilePath);
    const bundleName = BundlePathHelper.scanFilePathForAggregateFullName(
      retrievedContentFilePath,
      this.typeDefObj.defaultDirectory
    );
    const fileName = this.getMdapiFormattedContentFileName(retrievedContentFilePath, bundleName);
    return path.join(bundlePath, fileName);
  }

  // This returns the full path to the meta file for the LWC.
  // E.g., unpackaged/lwc/helloworld/helloworld.js-meta.xml
  getRetrievedMetadataPath(fileProperty, retrieveRoot: string, bundleFileProperties): string {
    // There may be an existing, easier way to do this but I don't see
    // anything in BundlePathHelper.  This takes an LWC file path and
    // extracts the bundle path to build the path to the LWC meta file.
    const bundleName = BundlePathHelper.scanFilePathForAggregateFullName(
      fileProperty.fileName,
      this.typeDefObj.defaultDirectory
    );
    const pathArray: string[] = path.dirname(fileProperty.fileName).split(path.sep);
    const bundleIndex = pathArray.lastIndexOf(bundleName);
    const bundlePath = pathArray.slice(0, bundleIndex + 1).join(path.sep);
    const fileName = BundlePathHelper.getMetadataFileNameFromBundleFileProperties(
      fileProperty.fullName,
      bundleFileProperties
    );
    const retrievedMetadataPath = path.join(retrieveRoot, bundlePath, fileName);
    if (srcDevUtil.pathExistsSync(retrievedMetadataPath)) {
      return retrievedMetadataPath;
    }
    return null;
  }

  getCorrespondingLWCDefinitionFileProperty(
    retrieveRoot: string,
    filePropertyFileName: string,
    lwcMetadataName: string,
    metadataRegistry
  ): any {
    const bundleDirPath = path.join(retrieveRoot, path.dirname(filePropertyFileName));
    const bundlePaths = glob.sync(path.join(bundleDirPath, '*'));
    const bundleDefinitionPath = bundlePaths.find(bundlePath => this.isDefinitionFile(bundlePath));
    const lwcDefinitionFileProperty = {
      type: lwcMetadataName,
      fileName: path.relative(retrieveRoot, bundleDefinitionPath),
      fullName: path.basename(bundleDefinitionPath, path.extname(bundleDefinitionPath))
    };
    return lwcDefinitionFileProperty;
  }

  // For LWC, the meta file is always in the bundle dir with `-meta.xml` appended to the
  // main JS file.
  // E.g., lwc/helloworld/helloworld.js-meta.xml
  isDefinitionFile(filePath: string): boolean {
    const fixedFilePath = PathUtil.replaceForwardSlashes(filePath);
    const fileExt = (path.extname(fixedFilePath) || '').toLowerCase();
    if (fileExt === '.js') {
      const pathArray: string[] = path.dirname(fixedFilePath).split(path.sep);
      const aggFullName = BundlePathHelper.scanFilePathForAggregateFullName(
        fixedFilePath,
        this.typeDefObj.defaultDirectory
      );
      const fileName = path.parse(fixedFilePath).name;
      return aggFullName === fileName && aggFullName === pathArray[pathArray.length - 1];
    }
    return false;
  }

  shouldDeleteWorkspaceAggregate(metadataType: string): boolean {
    // Handle deletes of LightningComponentBundles at the subcomponent level because
    // SourceMembers are created for each subcomponent
    return false;
  }

  trackRemoteChangeForSourceMemberName(sourceMemberName: string): boolean {
    // Whenever a resource of an LightningComponentBundle is modified in the scratch org, a SourceMember is created
    // at the bundle level and another is created for the changed resource. Ignore the SourceMember created
    // for the bundle and track specific bundle resource changes only.
    return sourceMemberName.split(path.sep).length > 1;
  }

  onlyDisplayOneConflictPerAggregate(): boolean {
    //we only want to report one conflict entry per bundle
    return true;
  }

  getDisplayPathForLocalConflict(workspaceFilePath: string): string {
    return path.dirname(workspaceFilePath);
  }

  protected sourceMemberFullNameConflictsWithWorkspaceFullName(
    sourceMemberFullName: string,
    workspaceFullName: string
  ): boolean {
    const aggregateSourceMemberName = this.getAggregateFullNameFromSourceMemberName(sourceMemberFullName);
    const aggregateFullName = this.getAggregateFullNameFromWorkspaceFullName(workspaceFullName);
    return aggregateSourceMemberName === aggregateFullName;
  }

  getAggregateFullNameFromMdapiPackagePath(mdapiPackagePath: string): string {
    const pathElements = mdapiPackagePath.split(path.sep);
    return pathElements[1];
  }
}

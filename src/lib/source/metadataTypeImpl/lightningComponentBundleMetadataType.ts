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
  //
  // bundleFileProperties is an array that could contain an LWC definition file property built
  // from this.getCorrespondingLWCDefinitionFileProperty(), OR it could contain a generic
  // file property built from BundleMetadataType.getDefinitionProperties().  If it's the latter
  // we need to modify the filePaths of all LWCs to ensure a .js extension so we properly
  // resolve the meta.xml file.
  getRetrievedMetadataPath(fileProperty, retrieveRoot: string, bundleFileProperties): string {
    // There may be an existing, easier way to do this but I don't see
    // anything in BundlePathHelper.  This takes an LWC file path and
    // extracts the bundle path to build the path to the LWC meta file.
    const bundleName = BundlePathHelper.scanFilePathForAggregateFullName(
      fileProperty.fileName,
      this.typeDefObj.defaultDirectory
    );

    // ensure LWC bundleFileProperties have a fileName with .js extension
    const bundFileProps = bundleFileProperties.map(fileProp => {
      if (fileProp.type === 'LightningComponentBundle' && fileProp.fileName.endsWith('.css')) {
        fileProp.fileName = fileProp.fileName.replace(/\.css$/, '.js');
      }
      return fileProp;
    });

    const pathArray: string[] = path.dirname(fileProperty.fileName).split(path.sep);
    const bundleIndex = pathArray.lastIndexOf(bundleName);
    const bundlePath = pathArray.slice(0, bundleIndex + 1).join(path.sep);
    const fileName = BundlePathHelper.getMetadataFileNameFromBundleFileProperties(fileProperty.fullName, bundFileProps);
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
    let bundleDirPath = path.join(retrieveRoot, path.dirname(filePropertyFileName));
    // We assume that all LWC bundles are nested directly under the lwc/ directory. But bundles can have
    // subdirectories within themselves, so in the case that we have a subdirectory path where the parent directory
    // is not lwc/ then, we work backward until we find it
    // for example: force-app/main/default/lwc/appHeader/__mocks__/appHeader.js
    if (path.dirname(bundleDirPath) !== 'lwc') {
      const pathParts = path.join(retrieveRoot, path.dirname(filePropertyFileName)).split(path.sep);
      const lwcIndex = pathParts.findIndex(p => p === 'lwc');
      bundleDirPath = pathParts.slice(0, lwcIndex + 2).join(path.sep);
    }
    const bundlePaths = glob.sync(path.join(bundleDirPath, '*'));
    const bundleDefinitionPath = bundlePaths.find(bundlePath => this.isDefinitionFile(bundlePath));

    // LWCs can have the .css or .js file as the main LWC file, but the definition fileName
    // MUST be the .js extension in order to properly resolve the meta.xml file in the same
    // pattern as other bundle types.
    let fileName = bundleDefinitionPath;
    if (fileName.endsWith('.css')) {
      fileName = fileName.replace(/\.css$/, '.js');
    }

    const lwcDefinitionFileProperty = {
      type: lwcMetadataName,
      fileName: path.relative(retrieveRoot, fileName),
      fullName: path.basename(fileName, path.extname(fileName))
    };
    return lwcDefinitionFileProperty;
  }

  // For LWC, the meta file is always in the bundle dir with `.js-meta.xml` appended to the
  // LWC full name.
  // E.g., lwc/helloworld/helloworld.js-meta.xml
  // NOTE: I'm not sure what the original purpose of this function was; it doesn't seem to
  //       operate how I'd expect, but changing it to work differently than other bundle
  //       types is a time-consuming, uphill battle that is not worth it.  This takes a LWC
  //       file as input and returns true when it is either the main .js or .css file.
  isDefinitionFile(filePath: string): boolean {
    const fixedFilePath = PathUtil.replaceForwardSlashes(filePath);
    const fileExt = (path.extname(fixedFilePath) || '').toLowerCase();
    if (['.js', '.css'].includes(fileExt)) {
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

/*
 * Copyright (c) 2018, Salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root  or https://opensource.org/licenses/BSD-3-Clause
 */
const path = require('path');
const glob = require('glob');

const srcDevUtil = require('../../core/srcDevUtil');
const MetadataRegistry = require('../metadataRegistry');

import { DefaultMetadataType } from './defaultMetadataType';
import { TypeDefObj } from '../typeDefObj';
import * as PathUtil from '../sourcePathUtil';
import * as almError from '../../core/almError';

export class ExperienceBundleMetadataType extends DefaultMetadataType {
  CONTENT_FILE_FORMAT = '.json';
  static META_FILE_SUFFIX = '.site';

  constructor(typeDefObj: TypeDefObj) {
    super(typeDefObj);
  }

  /**
   * During sfdx:source:push, given the meta file for the changed site, get all the files that needs to be pushed
   * if given metadataFilePath is of "baseDir/force-app/main/default/experiences/byo21-meta.xml"
   * we need to return the files in the bundle of the site corresponding to byo21-meta.xml meta file
   * ie., all the files in "baseDir/force-app/main/default/experiences/byo21" dir (while ignoring the ones in forceIgnore file)
   */
  getOriginContentPathsForSourceConvert(
    metadataFilePath: string,
    workspaceVersion: string,
    unsupportedMimeTypes: string[],
    forceIgnore
  ): Promise<string[]> {
    return Promise.resolve(ExperienceBundleMetadataType.getContentFilePaths(metadataFilePath, forceIgnore));
  }

  /**
   * Get where the file will be placed in the temp mdDir dir
   *
   * @param originContentPath - origin path as in sfdx working dir
   * @param aggregateFullName
   * @param mdDir - temp folder path
   */
  getMdapiContentPathForSourceConvert(originContentPath: string, aggregateFullName: string, mdDir: string): string {
    const mdapiSourceDir = this.getPathToMdapiSourceDir(aggregateFullName, mdDir);
    const relativePathDir = this.getRelativeContentPath(originContentPath);
    return this.getMdapiFormattedContentPath(mdapiSourceDir, relativePathDir);
  }

  getRelativeContentPath(contentPath: string): string {
    return MetadataRegistry.splitOnDirName(this.typeDefObj.defaultDirectory, contentPath)[1];
  }

  /**
   * Given a path to the file in local working env, we should return the name of the site
   * If its a meta file, we just strip the -meta.xml to get the siteName
   * if its a json file, we return the grandparent directory (site name)
   * Otherwise, we return fileName (site name)
   * @param filePath
   */
  getAggregateFullNameFromFilePath(filePath: string): string {
    if (filePath.endsWith(ExperienceBundleMetadataType.getMetadataFileExtWithSuffix())) {
      //meta file
      const fileDir = filePath.split(path.sep);
      return fileDir[fileDir.length - 1].split(ExperienceBundleMetadataType.getMetadataFileExtWithSuffix())[0];
    } else if (path.extname(filePath) === this.CONTENT_FILE_FORMAT) {
      //content file (json)
      return PathUtil.getGrandparentDirectoryName(filePath);
    }

    //a path to the site dir
    return PathUtil.getFileName(filePath);
  }

  /**
   * Given a file, we need to return the corresponding site's meta file
   * @param filePath
   */
  getAggregateMetadataFilePathFromWorkspacePath(filePath): string {
    if (filePath.endsWith(ExperienceBundleMetadataType.getMetadataFileExtWithSuffix())) {
      return filePath;
    }
    const fileBrokenPaths = MetadataRegistry.splitOnDirName(this.typeDefObj.defaultDirectory, filePath);
    const metaXmlFileName = this.getMetaFileName(fileBrokenPaths[1]);
    return path.join(fileBrokenPaths[0], this.typeDefObj.defaultDirectory, metaXmlFileName);
  }
  getDefaultAggregateMetadataPath(fullName: string, defaultSourceDir: string, bundleFileProperties): string {
    return path.join(defaultSourceDir, this.typeDefObj.defaultDirectory, this.getMetaFileName(fullName));
  }

  getAggregateFullNameFromFileProperty(fileProperty, namespace: string): string {
    return PathUtil.getGrandparentDirectoryName(fileProperty.fullName);
  }

  /**
   * The path of every file. Given the file location in base working dir of the meta file and
   * the temp location of a file of the corresponding site, we need to give where the file (in temp location) will sit in the
   * base working dir
   * @param metadataFilePath
   * @param retrievedContentFilePath
   */
  getWorkspaceContentFilePath(metadataFilePath, retrievedContentFilePath): string {
    const workspaceDir = path.dirname(metadataFilePath);
    const fileName = MetadataRegistry.splitOnDirName(this.typeDefObj.defaultDirectory, retrievedContentFilePath)[1];
    return path.join(workspaceDir, fileName);
  }

  getRetrievedMetadataPath(fileProperty, retrieveRoot: string, bundleFileProperties): string {
    const bundlePath = this.stripBundlePath(path.dirname(fileProperty.fileName));
    const fileName = this.getMetaFileName(fileProperty.fullName);
    const retrievedMetadataPath = path.join(retrieveRoot, bundlePath, fileName);
    if (srcDevUtil.pathExistsSync(retrievedMetadataPath)) {
      return retrievedMetadataPath;
    } else {
      throw almError('MissingMetadataFile', retrievedMetadataPath);
    }
  }

  /**
   * A bundlPath is of format /unpackaged/experiences/{siteName}/{type}
   * We just need /unpackaged/experiences, which is where the -meta.xml lives
   * @param bundlePath
   */
  stripBundlePath(bundlePath): string {
    const folderPath = bundlePath.split(path.sep);
    return path.join(folderPath[0], folderPath[1]);
  }

  static getContentFilePaths(metadataFilePath: string, forceIgnore): string[] {
    const fileName = path.basename(metadataFilePath);
    const dirName = fileName.split(ExperienceBundleMetadataType.getMetadataFileExtWithSuffix())[0];
    const bundlePaths = glob.sync(path.join(path.dirname(metadataFilePath), dirName, '**'), { nodir: true });
    // Return normalized paths depending on the os
    return bundlePaths.map(filePath => path.normalize(filePath)).filter(bundlePath => forceIgnore.accepts(bundlePath));
  }

  /**
   * fullName is of the format {siteName}/{type}/{componentName-WithoutSuffix}
   * To get -meta.xml, we just need {siteName} as it is of the format {siteName}-meta.xml
   * @param fullName
   */
  getMetaFileName(fullName: string): string {
    if (fullName.startsWith(path.sep)) {
      fullName = fullName.slice(1);
    }
    const bundleName = fullName.split(path.sep)[0];
    return `${path.basename(bundleName)}${ExperienceBundleMetadataType.getMetadataFileExtWithSuffix()}`;
  }

  protected sourceMemberFullNameConflictsWithWorkspaceFullName(sourceMemberFullName: string, workspaceFullName: string): boolean {
    return PathUtil.getGrandparentDirectoryName(sourceMemberFullName) === PathUtil.getGrandparentDirectoryName(workspaceFullName);
  }

  getAggregateFullNameFromSourceMemberName(sourceMemberName: string): string {
      return sourceMemberName.split(path.sep)[0];
  }

  trackRemoteChangeForSourceMemberName(sourceMemberName: string): boolean {
      return sourceMemberName.split(path.sep).length > 1;
  }

  sourceMemberFullNameCorrespondsWithWorkspaceFullName(sourceMemberFullName: string, workspaceFullName: string): boolean {
      return sourceMemberFullName === workspaceFullName;
  }
  
  getFullNameFromFilePath(filePath: string): string {
      const grandParentBundleName = PathUtil.getGrandparentDirectoryName(filePath);
      const bundleName = PathUtil.getParentDirectoryName(filePath);
      const fileName = PathUtil.removeMetadataFileExtFrom(path.basename(filePath));
      return path.join(grandParentBundleName, bundleName, fileName);
  }

  static getMetadataFileExtWithSuffix(): string {
      return `${ExperienceBundleMetadataType.META_FILE_SUFFIX}${MetadataRegistry.getMetadataFileExt()}`;
  }

  mainContentFileExists(metadataFilePath: string): boolean {
    return srcDevUtil.pathExistsSync(metadataFilePath);
  }
}

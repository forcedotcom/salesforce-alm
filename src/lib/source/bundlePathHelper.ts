/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import MetadataRegistry = require('./metadataRegistry');
import * as glob from 'glob';

import * as PathUtil from './sourcePathUtil';
const { env } = require('@salesforce/kit');

// A safer while loop that will exit and throw an error when a user provided guard function
// is provided or the default guard function returns true.
function guardedWhile(conditionFn: () => boolean, func: () => any, guard?: () => boolean) {
  let i = 0;
  const max_loops = parseInt(env.getString('SFDX_GUARDED_WHILE_MAX_ITERATIONS', '10000'), 10);
  const _guard = guard || (() => i > max_loops);

  while (conditionFn()) {
    i++;
    if (_guard()) {
      throw new Error('WARNING: Infinite loop detected.');
    }
    func();
  }
}

/**
 * This class contains helper functions to calculate Bundle type paths (AuraDefinitionBundle, LightningComponentBundle)
 */
export class BundlePathHelper {
  static getPathFromBundleTypeFileProperties(
    fullName,
    defaultSourceDir,
    defaultDirName,
    bundleFileTypeProperties
  ): string {
    const bundleName = fullName.split(path.sep)[0];
    const pathToDefaultTypeDirectory = path.join(defaultSourceDir, defaultDirName);
    const fileName = BundlePathHelper.getMetadataFileNameFromBundleFileProperties(fullName, bundleFileTypeProperties);
    return path.join(pathToDefaultTypeDirectory, bundleName, fileName);
  }

  static getMetadataFileNameFromBundleFileProperties(fullName, bundleFileTypeProperties): string {
    const bundleName = fullName.split(path.sep)[0];
    const matchingBundle = bundleFileTypeProperties.find(
      fileProperty => fileProperty.fullName.split(path.sep)[0] === bundleName
    );
    return `${path.basename(matchingBundle.fileName)}${MetadataRegistry.getMetadataFileExt()}`;
  }

  static findMetadataFilePathInBundleDir(filePath: string, bundleTypeDefaultDirName: string) {
    if (filePath.endsWith(MetadataRegistry.getMetadataFileExt())) {
      return filePath;
    } else {
      // Each bundle has one metadata file path that ends with its definition suffix + '-meta.xml'
      // and is located directly in the bundle directory (not a subfolder)
      // This finds and scans the bundle directory to find the existing aggregate metadata file path
      let bundlePath;
      let pathName = path.dirname(filePath);
      let folderName = path.basename(pathName);

      // LightningComponentBundle folder structure can be multi-level; Scan for the direct child folder
      // which is the bundle path
      const findPath = () => {
        bundlePath = pathName;
        pathName = path.dirname(pathName);
        folderName = path.basename(pathName);
      };
      guardedWhile(() => !(folderName === bundleTypeDefaultDirName), findPath);

      const matchingFilePaths = glob.sync(path.join(bundlePath, `*${MetadataRegistry.getMetadataFileExt()}`));
      if (matchingFilePaths.length > 0) {
        // glob returns paths using the forward slash only, which breaks in Windows
        return PathUtil.replaceForwardSlashes(matchingFilePaths[0]);
      }
      // In the case that a bundle has been deleted from the workspace, a search for its definition file
      // will produce no results. In this case, return the filePath being processed.
      return filePath;
    }
  }

  static buildFullNameFromFilePath(filePath: string, defaultDirectory: string): string {
    const filePathWithoutMetadataExt = PathUtil.removeMetadataFileExtFrom(filePath);
    let pathName = path.dirname(filePathWithoutMetadataExt);
    let bundleName = path.basename(pathName);
    const fileName = path.basename(filePathWithoutMetadataExt);
    let fullName = path.join(bundleName, fileName);
    // Walk back up directory structure to build fullName to include subfolder hierarchy within the fullName
    const findPath = () => {
      pathName = path.dirname(pathName);
      bundleName = path.basename(pathName);
      fullName = path.join(bundleName, fullName);
    };
    guardedWhile(() => !(path.basename(path.dirname(pathName)) === defaultDirectory), findPath);

    return fullName;
  }

  static scanFilePathForAggregateFullName(filePath: string, defaultDirectory: string): string {
    const parsedFilePath = path.parse(filePath);

    // If the filePath is the bundle dir, return that
    if (path.basename(parsedFilePath.dir) === defaultDirectory && parsedFilePath.ext === '') {
      return parsedFilePath.name;
    }

    const pathArray: string[] = parsedFilePath.dir.split(path.sep);
    const defaultDirIndex = pathArray.lastIndexOf(defaultDirectory);

    // Return undefined if the defaultDirectory is not in the filePath, or if we find it but
    // there's no bundle name directory (unlikely, but guards against array index out of bounds).
    if (defaultDirIndex === -1 || defaultDirIndex + 1 > pathArray.length) {
      return;
    }

    // Return the bundle name from the filePath
    return pathArray[defaultDirIndex + 1];
  }

  static getAllNestedBundleContentPaths(bundleDirPath: string, forceIgnore): Promise<string[]> {
    const bundlePaths = glob.sync(path.join(bundleDirPath, '**'), {
      nodir: true
    });
    return Promise.resolve(
      bundlePaths
        .map(bundlePath => PathUtil.replaceForwardSlashes(bundlePath))
        .filter(
          bundlePath => forceIgnore.accepts(bundlePath) && !bundlePath.endsWith(MetadataRegistry.getMetadataFileExt())
        )
    );
  }

  static getExtendedBundlePath(fileName: string, bundleName: string): string {
    // Is there a nested directory or directories; if so this takes the full file name and
    // returns the directory path between the file and bundleName
    let extendedPath;
    if (fileName && fileName.includes(bundleName)) {
      let nestedDir = path.dirname(fileName);
      let nestedDirName = path.basename(nestedDir);

      const findPath = () => {
        if (extendedPath) {
          extendedPath = path.join(nestedDirName, extendedPath);
        } else {
          extendedPath = nestedDirName;
        }
        nestedDir = path.dirname(nestedDir);
        nestedDirName = path.basename(nestedDir);
      };
      guardedWhile(() => nestedDirName !== bundleName, findPath);
    }

    return extendedPath;
  }
}

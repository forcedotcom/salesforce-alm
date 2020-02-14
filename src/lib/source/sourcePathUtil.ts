/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';

import * as fs from 'fs-extra';
import * as _ from 'lodash';

import MetadataRegistry = require('./metadataRegistry');
import * as glob from 'glob';

/**
 * Returns the given filePath without '-meta.xml'
 *
 * @param {string} filePath
 * @returns {string}
 */
export const removeMetadataFileExtFrom = function(filePath: string): string {
  return filePath.replace(MetadataRegistry.getMetadataFileExt(), '');
};

/**
 * Returns the fileName stripped of any file extensions
 * @param {string} filePath
 * @param {TypeDefObj} typeDef
 * @returns {string}
 */
export const getFileName = function(filePath: string) {
  const filePathWithoutMetadataExt = removeMetadataFileExtFrom(filePath);
  return path.basename(filePathWithoutMetadataExt, path.extname(filePathWithoutMetadataExt));
};

/**
 * Returns the parent directory name
 * Example: /parentDir/fileName.ext returns 'parentDir'
 *
 * @param {string} filePath
 * @returns {string}
 */
export const getParentDirectoryName = function(filePath: string) {
  return path.basename(path.dirname(filePath));
};

/**
 * Returns the grandparent directory name
 * Example: grandparentDir/parentDir/fileName.ext returns 'grandparentDir'
 *
 * @param {string} filePath
 * @returns {string}
 */
export const getGrandparentDirectoryName = function(filePath: string) {
  return path.basename(path.dirname(path.dirname(filePath)));
};

/**
 * Returns the truncated path to the given directory
 * Example: filePath='path/to/specialDir/containing/stuff' dirName='specialDir' returns 'path/to/specialDir'
 *
 * @param {string} filePath
 * @param {string} dirName
 * @returns {string}
 */
export const getPathToDir = function(filePath: string, dirName: string): string {
  const filePathParts = filePath.split(path.sep);
  const indexOfGivenDir = filePathParts.indexOf(dirName);
  if (indexOfGivenDir !== -1) {
    let newFilePath = path.join(...filePathParts.slice(0, indexOfGivenDir + 1));
    if (filePath.startsWith(path.sep)) {
      newFilePath = `${path.sep}${newFilePath}`;
    }
    return newFilePath;
  }
  return null;
};

export const getContentPathWithNonStdExtFromMetadataPath = function(metadataFilePath: string): string {
  const fileNameWithoutExtensions = getFileName(metadataFilePath);
  let matchingWorkspaceFiles = glob.sync(path.join(path.dirname(metadataFilePath), `${fileNameWithoutExtensions}*`));
  matchingWorkspaceFiles = matchingWorkspaceFiles.map(filePath => path.resolve(filePath)); // glob returns paths using the forward slash only, which breaks tests in Windows
  return matchingWorkspaceFiles.find(
    docFile =>
      fileNamesWithoutExtensionsMatch(path.basename(docFile), fileNameWithoutExtensions) &&
      !docFile.endsWith(MetadataRegistry.getMetadataFileExt())
  );
};

export const fileNamesWithoutExtensionsMatch = function(filename1: string, filename2: string): boolean {
  return path.basename(filename1, path.extname(filename1)) === path.basename(filename2, path.extname(filename2));
};

export const removeParentDirFromPath = function(filePath: string): string {
  const fileName = path.basename(filePath);
  return path.join(path.dirname(path.dirname(filePath)), fileName);
};

/**
 * Replace forward slashes with path separators
 *
 * @param {string} str
 * @returns {string}
 */
export const replaceForwardSlashes = function(str: string): string {
  return str.replace(/\//g, path.sep);
};

/**
 * Encode a string similarly to how Metadata API encodes (spaces not encoded)
 *
 * @param {string} str
 * @returns {string}
 */
export const encodeMetadataString = function(str: string): string {
  return encodeURIComponent(str).replace(/%20/g, ' ');
};

/**
 * gets a list of sub-directories from a parent directory.
 * @param {string} filePath The path to look for nested directories
 * @returns {string[]} An array of all sub directories
 */
export const getNestedDirectoryPaths = function(filePath: string): string[] {
  const accum = [];

  const _recur = (_filePath: string) => {
    if (_filePath) {
      try {
        // Is the sub folder accessible?
        fs.accessSync(_filePath, fs.constants.R_OK);

        const stats: fs.Stats = fs.statSync(_filePath);

        // Is it a directory?
        if (stats.isDirectory()) {
          accum.push(_filePath);
          const dirListing: string[] = fs.readdirSync(_filePath);
          // Is the folder empty?
          dirListing.forEach(_path => {
            const subPath: string = path.join(_filePath, _path);
            _recur(subPath);
          });
        }
      } catch (e) {
        // If we can't access the filepath then lets stop.
      }
    }
  };
  _recur(filePath);
  return accum;
};

/**
 * Removes all the empty sub-directories
 * @param {string} filePath The parent path to look for empty directories. This directory will also be removed if it
 * ends up being empty.
 */
export function cleanEmptyDirs(filePath: string) {
  const paths: string[] = getNestedDirectoryPaths(filePath);

  // Sort all directory paths based on level count in descending order.
  paths.sort((a: string, b: string): number => {
    const aLevelCount = _.split(a, path.sep).length;
    const bLevelCount = _.split(b, path.sep).length;
    if (aLevelCount > bLevelCount) return -1;
    return aLevelCount < bLevelCount ? 1 : 0;
  });

  // Iterate and deleted all the empty folders. If a parent becomes empty because it only contained empty folders it
  // will be deleted later because its level is one less.
  paths.forEach(_path => {
    const dirListing: string[] = fs.readdirSync(_path);
    if (dirListing.length === 0) {
      fs.removeSync(_path);
    }
  });
}

/**
 * Comparator function to sort an array of strings by parent child relationship.
 * @param left  {string} The left path string
 * @param right {string} The right path string
 * @returns
 * if the right path starts with the left path return 1
 * if the left path starts with the right path return -1
 * Everything else returns the result of left.localeCompare(right)
 */
export function deleteOrderComparator(left: string, right: string): number {
  if (left.startsWith(right) && left.length > right.length) {
    return -1;
  }

  if (right.startsWith(left) && right.length > left.length) {
    return 1;
  }

  return left.localeCompare(right);
}

/**
 * A better file exists function that ensures a file can be read from the filesystem.
 * @param path The absolute files path or relative path to a file from the CWD.
 */
export function canRead(path: string): boolean {
  if (path) {
    try {
      fs.existsSync(path, fs.constants.R_OK);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

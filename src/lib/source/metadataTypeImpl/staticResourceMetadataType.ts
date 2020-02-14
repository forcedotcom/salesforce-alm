/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as _ from 'lodash';

import MetadataRegistry = require('../metadataRegistry');

import { DefaultMetadataType } from './defaultMetadataType';
import { MetadataType } from '../metadataType';
import { StaticResource } from '../decompositionStrategy/staticResource';
import * as PathUtil from '../sourcePathUtil';

const STATIC_RESOURCES_DIR = 'staticresources';

export class StaticResourceMetadataType extends DefaultMetadataType {
  /**
   * Returns the file path to the corresponding static resource directory based on the static
   * resource sourcePath.  E.g.,
   *   force-app/main/default/staticresources/SiteSamples/img/ --> force-app/main/default/staticresources/SiteSample
   *   force-app/main/default/staticresources/SiteSamples/img/clock.png --> force-app/main/default/staticresources/SiteSample
   *
   * @param sourcePath absolute or relative path to a static resource file or sub-directory.
   */
  resolveSourcePath(sourcePath: string): string {
    return this.slicePath(sourcePath, STATIC_RESOURCES_DIR, 2).join(path.sep);
  }

  // Splits a file path into an array, then slices it based on a directory name and index modifier.
  private slicePath(filePath: string, dirName: string, modifier: number = 1): string[] {
    let filePathArray = filePath.split(path.sep);
    const index = dirName ? filePathArray.lastIndexOf(dirName) : filePathArray.length;
    return filePathArray.slice(0, Math.min(index + modifier, filePathArray.length));
  }

  getFullNameFromFilePath(filePath: string): string {
    return this.getAggregateFullNameFromFilePath(filePath);
  }

  getAggregateFullNameFromFilePath(filePath: string): string {
    if (filePath.endsWith(`${this.typeDefObj.ext}${MetadataRegistry.getMetadataFileExt()}`)) {
      return path.basename(StaticResourceMetadataType.removeExtensions(filePath));
    }

    const staticResource = _.last(this.slicePath(filePath, STATIC_RESOURCES_DIR, 2));
    return StaticResourceMetadataType.removeExtensions(staticResource);
  }

  getAggregateMetadataFilePathFromWorkspacePath(filePath) {
    // used to be StaticResource.getMetadataFilePathFor()
    const staticResourcesPath = this.slicePath(filePath, STATIC_RESOURCES_DIR).join(path.sep);
    const fullName = this.getFullNameFromFilePath(filePath);
    return path.join(staticResourcesPath, `${fullName}.${this.typeDefObj.ext}${MetadataRegistry.getMetadataFileExt()}`);
  }

  getOriginContentPathsForSourceConvert(
    metadataFilePath: string,
    workspaceVersion: string,
    unsupportedMimeTypes: string[],
    forceIgnore
  ): Promise<string[]> {
    const staticResource = new StaticResource(
      metadataFilePath,
      <MetadataType>this,
      workspaceVersion,
      undefined,
      unsupportedMimeTypes
    );
    return staticResource.getResource().then(resourcePath => Promise.resolve([resourcePath]));
  }

  protected getMdapiFormattedContentFileName(originContentPath: string, aggregateFullName: string): string {
    return `${aggregateFullName}.${this.typeDefObj.ext}`;
  }

  mainContentFileExists(metadataFilePath: string): boolean {
    const contentFilePath = PathUtil.getContentPathWithNonStdExtFromMetadataPath(metadataFilePath);
    return !_.isNil(contentFilePath);
  }

  private static removeExtensions(filePath: string): string {
    if (path.extname(filePath) === '') {
      return filePath;
    } else {
      return StaticResourceMetadataType.removeExtensions(
        path.join(path.dirname(filePath), path.basename(filePath, path.extname(filePath)))
      );
    }
  }

  getComponentFailureWorkspaceContentPath(metadataFilePath: string, workspaceContentPaths: string[]): string {
    const sr = new StaticResource(metadataFilePath, <MetadataType>this, undefined);
    if (sr.isExplodedArchive()) {
      const explodedDir = PathUtil.getFileName(metadataFilePath);
      return path.join(path.dirname(metadataFilePath), explodedDir);
    }
    return workspaceContentPaths[0];
  }

  shouldDeleteWorkspaceAggregate(metadataType: string): boolean {
    // Handle deletes of staticResources at the subcomponent level
    return false;
  }
}

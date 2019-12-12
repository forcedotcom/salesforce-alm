/*
 * Copyright (c) 2018, Salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root  or https://opensource.org/licenses/BSD-3-Clause
 */
const srcDevUtil = require('../../core/srcDevUtil');

import { ForceIgnore } from '../forceIgnore';
import { NonDecomposedContentStrategy } from './nonDecomposedContentStrategy';
import { MetadataType } from '../metadataType';
import { ExperienceBundleMetadataType } from '../metadataTypeImpl/experienceBundleMetadataType';

/**
 * Works on top of NonDecomposedContentStrategy with special logic to handle delete
 */
export class ExperienceBundleContentStrategy extends NonDecomposedContentStrategy {
  forceIgnore: ForceIgnore;

  constructor(metadataType: MetadataType, metadataRegistry, workspaceVersion) {
    super(metadataType, metadataRegistry, workspaceVersion);
    this.forceIgnore = new ForceIgnore();
  }

  /**
   * If there is a file in existing path and if it didn't get returned in the MD-retrieve, then we assume it is deleted
   * Since, we need a list of all files from retrieve to compare we cannot use MetadataType#getWorkspaceElementsToDelete()
   */
  saveContent(
    metadataFilePath: string,
    retrievedContentFilePaths: string[],
    retrievedMetadataFilePath: string,
    createDuplicates: boolean,
    unsupportedMimeTypes: string[]
  ): [string[], string[], string[], string[]] {
    const existingFiles = ExperienceBundleMetadataType.getContentFilePaths(metadataFilePath, this.forceIgnore);
    var [newPaths, updatedPaths, deletedPaths, dupPaths] = super.saveContent(
      metadataFilePath,
      retrievedContentFilePaths,
      retrievedMetadataFilePath,
      createDuplicates,
      unsupportedMimeTypes
    );
    const relativeRetrievedPaths = retrievedContentFilePaths.map(path =>
      this.metadataType.getRelativeContentPath(path)
    );
    existingFiles.forEach(path => {
      const relativePath = this.metadataType.getRelativeContentPath(path);
      if (!relativeRetrievedPaths.includes(relativePath)) {
        srcDevUtil.deleteIfExistsSync(path);
        deletedPaths.push(path);
      }
    });
    return [newPaths, updatedPaths, deletedPaths, dupPaths];
  }
}

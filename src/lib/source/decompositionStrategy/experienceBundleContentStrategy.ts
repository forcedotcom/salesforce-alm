/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxProject } from '@salesforce/core';

const srcDevUtil = require('../../core/srcDevUtil');

import { ForceIgnore } from '@salesforce/source-deploy-retrieve/lib/src/metadata-registry/forceIgnore';
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
    this.forceIgnore = ForceIgnore.findAndCreate(SfdxProject.resolveProjectPathSync());
  }

  /**
   * If there is a file in existing path and if it didn't get returned in the MD-retrieve, then we assume it is deleted
   * Since, we need a list of all files from retrieve to compare we cannot use MetadataType#getWorkspaceElementsToDelete()
   */
  async saveContent(
    metadataFilePath: string,
    retrievedContentFilePaths: string[],
    retrievedMetadataFilePath: string,
    createDuplicates: boolean,
    unsupportedMimeTypes: string[],
    forceoverwrite = false
  ): Promise<[string[], string[], string[], string[]]> {
    const existingFiles = ExperienceBundleMetadataType.getContentFilePaths(metadataFilePath, this.forceIgnore);
    let [newPaths, updatedPaths, deletedPaths, dupPaths] = await super.saveContent(
      metadataFilePath,
      retrievedContentFilePaths,
      retrievedMetadataFilePath,
      createDuplicates,
      unsupportedMimeTypes,
      forceoverwrite
    );
    const relativeRetrievedPaths = retrievedContentFilePaths.map((path) =>
      this.metadataType.getRelativeContentPath(path)
    );
    existingFiles.forEach((path) => {
      const relativePath = this.metadataType.getRelativeContentPath(path);
      if (!relativeRetrievedPaths.includes(relativePath)) {
        srcDevUtil.deleteIfExistsSync(path);
        deletedPaths.push(path);
      }
    });
    return [newPaths, updatedPaths, deletedPaths, dupPaths];
  }
}

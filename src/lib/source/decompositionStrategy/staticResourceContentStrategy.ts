/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataType } from '../metadataType';

import { ContentDecompositionStrategy } from './contentDecompositionStrategy';
import { StaticResource } from './staticResource';

export class StaticResourceContentStrategy implements ContentDecompositionStrategy {
  metadataType: MetadataType;
  metadataRegistry;
  workspaceVersion;

  constructor(metadataType: MetadataType, metadataRegistry, workspaceVersion) {
    this.metadataType = metadataType;
    this.metadataRegistry = metadataRegistry;
    this.workspaceVersion = workspaceVersion;
  }

  getContentPaths(metadataFilePath: string): string[] {
    const staticResource = new StaticResource(metadataFilePath, this.metadataType, this.workspaceVersion);
    return staticResource.getContentPaths();
  }

  async saveContent(
    metadataFilePath,
    retrievedContentFilePaths,
    retrievedMetadataFilePath,
    createDuplicates,
    unsupportedMimeTypes: string[],
    forceoverwrite = false
  ): Promise<[string[], string[], string[], string[]]> {
    const newPaths = [];
    const staticResource = new StaticResource(
      metadataFilePath,
      this.metadataType,
      this.workspaceVersion,
      retrievedMetadataFilePath,
      unsupportedMimeTypes
    );
    const [updatedPaths, duplicatePaths, deletedPaths] = await staticResource.saveResource(
      retrievedContentFilePaths[0],
      createDuplicates,
      forceoverwrite
    );
    return [newPaths, updatedPaths, deletedPaths, duplicatePaths];
  }
}

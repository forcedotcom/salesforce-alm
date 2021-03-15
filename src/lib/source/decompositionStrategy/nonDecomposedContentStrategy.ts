/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs-extra';
import { fs as fscore } from '@salesforce/core';
import * as path from 'path';

import MetadataRegistry = require('../metadataRegistry');
import srcDevUtil = require('../../core/srcDevUtil');
import { ContentDecompositionStrategy } from './contentDecompositionStrategy';
import { MetadataTypeFactory } from '../metadataTypeFactory';
import { MetadataType } from '../metadataType';

/**
 *  Content strategy for content files that do not require decomposition e.g. ApexClass
 */
export class NonDecomposedContentStrategy implements ContentDecompositionStrategy {
  metadataType: any;
  metadataRegistry;

  constructor(metadataType: MetadataType, metadataRegistry, workspaceVersion) {
    this.metadataType = metadataType;
    this.metadataRegistry = metadataRegistry;
  }

  getContentPaths(metadataFilePath: string): string[] {
    const metadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(metadataFilePath, this.metadataRegistry);
    const aggregateFullName = metadataType.getAggregateFullNameFromFilePath(metadataFilePath);
    const workspaceDir = path.dirname(metadataFilePath);
    const directoryItems = srcDevUtil.getDirectoryItems(workspaceDir, true, true);
    return directoryItems.filter(directoryItem => {
      const itemFullName = metadataType.getAggregateFullNameFromFilePath(directoryItem);
      return (
        !directoryItem.startsWith('.') &&
        !directoryItem.endsWith(MetadataRegistry.getMetadataFileExt()) &&
        aggregateFullName === itemFullName
      );
    });
  }

  async saveContent(
    metadataFilePath: string,
    retrievedContentFilePaths: string[],
    retrievedMetadataFilePath: string,
    createDuplicates: boolean,
    unsupportedMimeTypes: string[],
    forceoverwrite = false
  ): Promise<[string[], string[], string[], string[]]> {
    const newPaths = [];
    const updatedPaths = [];
    const deletedPaths = [];
    const dupPaths = [];
    const metadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(metadataFilePath, this.metadataRegistry);

    for (const retrievedContentFilePath of retrievedContentFilePaths) {
      const workspaceContentFilePath = metadataType.getWorkspaceContentFilePath(
        metadataFilePath,
        retrievedContentFilePath
      );
      if (srcDevUtil.pathExistsSync(workspaceContentFilePath)) {
        const equalFileCheck = await fscore.areFilesEqual(retrievedContentFilePath, workspaceContentFilePath);
        if (forceoverwrite || !equalFileCheck) {
          if (createDuplicates) {
            const dupPath = workspaceContentFilePath + '.dup';
            fs.copySync(retrievedContentFilePath, dupPath);

            dupPaths.push(dupPath);
          } else {
            fs.copySync(retrievedContentFilePath, workspaceContentFilePath);

            updatedPaths.push(workspaceContentFilePath);
          }
        }
      } else {
        fs.copySync(retrievedContentFilePath, workspaceContentFilePath);
        newPaths.push(workspaceContentFilePath);
      }
    }
    return [newPaths, updatedPaths, deletedPaths, dupPaths];
  }
}

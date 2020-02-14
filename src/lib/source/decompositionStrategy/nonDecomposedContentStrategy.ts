/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs-extra';
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

  saveContent(
    metadataFilePath: string,
    retrievedContentFilePaths: string[],
    retrievedMetadataFilePath: string,
    createDuplicates: boolean,
    unsupportedMimeTypes: string[]
  ): [string[], string[], string[], string[]] {
    const newPaths = [];
    const updatedPaths = [];
    const deletedPaths = [];
    const dupPaths = [];
    const metadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(metadataFilePath, this.metadataRegistry);
    retrievedContentFilePaths.forEach(retrievedContentFilePath => {
      const workspaceContentFilePath = metadataType.getWorkspaceContentFilePath(
        metadataFilePath,
        retrievedContentFilePath
      );
      if (srcDevUtil.pathExistsSync(workspaceContentFilePath)) {
        if (!NonDecomposedContentStrategy.filesAreEqual(retrievedContentFilePath, workspaceContentFilePath)) {
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
    });
    return [newPaths, updatedPaths, deletedPaths, dupPaths];
  }

  private static filesAreEqual(filePathA, filePathB) {
    const contentA = fs.readFileSync(filePathA);
    const contentB = fs.readFileSync(filePathB);
    const contentHashA = srcDevUtil.getContentHash(contentA);
    const contentHashB = srcDevUtil.getContentHash(contentB);
    return contentHashA === contentHashB;
  }
}

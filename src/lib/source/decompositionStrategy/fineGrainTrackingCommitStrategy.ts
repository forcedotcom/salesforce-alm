/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as path from 'path';
import * as fs from 'fs';

// Local
import srcDevUtil = require('../../core/srcDevUtil');

import { DecompositionConfig } from './decompositionConfig';
import { DecompositionCommitStrategy } from './decompositionCommitStrategy';
import { MetadataDocument } from '../metadataDocument';

/**
 * This strategy implementation writes updated files (when contents are different),
 * and new files. No attempt is made to delete anything because with fine grain tracking
 * the deletions should be happening independent of the decomposition.
 */
export class FineGrainTrackingCommitStrategy implements DecompositionCommitStrategy {
  decompositionConfig: DecompositionConfig;

  constructor(decompositionConfig: DecompositionConfig) {
    this.decompositionConfig = decompositionConfig;
  }

  commit(
    documents: Map<string, MetadataDocument>,
    existingPaths: string[],
    createDuplicates: boolean
  ): [string[], string[], string[], string[]] {
    let newPaths: string[];
    let updatedPaths: string[];
    [newPaths, updatedPaths] = this.categorizePaths(documents, existingPaths);
    let deletedPaths: string[] = []; // With fine grain tracking any deletes are handled independently of the decomposition.
    let dupPaths: string[] = [];

    updatedPaths = updatedPaths.filter(updatedPath => {
      if (FineGrainTrackingCommitStrategy.isUpdatedFile(updatedPath, documents.get(updatedPath))) {
        if (createDuplicates) {
          const dupPath = updatedPath + '.dup';
          fs.writeFileSync(dupPath, documents.get(updatedPath).getRepresentation());
          dupPaths.push(dupPath);
          return false;
        } else {
          fs.writeFileSync(updatedPath, documents.get(updatedPath).getRepresentation());
          return true;
        }
      } else {
        // even if generateDupFiles was true, we don't want to create .dup files if the contents of the files are identical
        return false;
      }
    });

    newPaths.map(newPath => {
      srcDevUtil.ensureDirectoryExistsSync(path.dirname(newPath));
      fs.writeFileSync(newPath, documents.get(newPath).getRepresentation());
    });

    return [newPaths, updatedPaths, deletedPaths, dupPaths];
  }

  private categorizePaths(documents: Map<string, MetadataDocument>, existingPaths: string[]): [string[], string[]] {
    const newPaths: string[] = [];
    const updatedPaths: string[] = [];

    documents.forEach((document, documentPath) => {
      if (existingPaths.includes(documentPath)) {
        updatedPaths.push(documentPath);
      } else {
        newPaths.push(documentPath);
      }
    });

    return [newPaths, updatedPaths];
  }

  /**
   * We parse and serialize both sides of the comparison so that we are comparing apples to apples.
   * This eliminated problems with whitespace, eg, but won't help us with reordering.
   * At worst we'll update the fs unnecessarily if the files are semantically equivalent
   * but perceived to be different. It's not the end of the world.
   *
   * @param filePath path to the existing file
   * @param document the parsed version of the new contents
   * @param documentFactory a factory to acquire a new document of the appropriate type for serialization
   * @returns {boolean} <code>true</code> if updated
   */
  private static isUpdatedFile(filePath: string, document: MetadataDocument): boolean {
    return !document.isEquivalentTo(fs.readFileSync(filePath, 'utf8'));
  }
}

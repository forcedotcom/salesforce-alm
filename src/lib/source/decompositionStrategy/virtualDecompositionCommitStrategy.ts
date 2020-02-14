/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as fs from 'fs';
import * as util from 'util';

import { DecompositionConfig } from './decompositionConfig';
import { DecompositionCommitStrategy } from './decompositionCommitStrategy';
import { FineGrainTrackingCommitStrategy } from './fineGrainTrackingCommitStrategy';
import { MetadataDocument } from '../metadataDocument';

/**
 * When we don't have fine grain tracking we most likely aren't decomposing into "real" (mdapi addressable) metadata entities.
 * In these virtual decomposition cases deletions become the responsibility of the decomposition.
 */
export class VirtualDecompositionCommitStrategy extends FineGrainTrackingCommitStrategy
  implements DecompositionCommitStrategy {
  constructor(decompositionConfig: DecompositionConfig) {
    super(decompositionConfig);
  }

  commit(
    documents: Map<string, MetadataDocument>,
    existingPaths: string[],
    createDuplicates: boolean
  ): [string[], string[], string[], string[]] {
    let newPaths: string[];
    let deletedPaths: string[];
    let updatedPaths: string[];
    let dupPaths: string[] = [];
    [newPaths, updatedPaths, deletedPaths, dupPaths] = super.commit(
      documents,
      existingPaths,
      createDuplicates /** generateDuplicates */
    );

    deletedPaths = this.getDeletedPaths(documents, existingPaths); // No fine grain tracking to help us here.
    deletedPaths.map(deletedPath => fs.unlinkSync(deletedPath));

    return [newPaths, updatedPaths, deletedPaths, dupPaths];
  }

  getDeletedPaths(documents: Map<string, MetadataDocument>, existingPaths: string[]): string[] {
    return existingPaths.reduce((deletedPaths, existingPath) => {
      if (util.isNullOrUndefined(documents.get(existingPath))) {
        deletedPaths.push(existingPath);
      }
      return deletedPaths;
    }, []);
  }
}

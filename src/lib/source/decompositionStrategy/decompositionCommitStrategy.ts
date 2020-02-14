/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataDocument } from '../metadataDocument';

/**
 * Strategy for comiting decompositions to the file system.
 *
 * Of particular interest is deletion. If an aggregate object has fine grain tracking for its bits then these will be
 * deleted independently of a decomposition. If not, then deletion might be the responsibility of this strategy (by
 * looking at what's "missing" from the decompositions viz a viz the workspace).
 */
export interface DecompositionCommitStrategy {
  commit(
    documents: Map<string, MetadataDocument>,
    existingPaths: string[],
    createDuplicates: boolean
  ): [string[], string[], string[], string[]];
}

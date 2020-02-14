/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DecompositionConfig, DecomposedSubtypeConfig } from './decompositionConfig';

/**
 * Decomposition configuration for the describeMetadata decomposition and the folder per subtype
 * workspace manifestation.
 */
export class CustomObjectTranslationDecompositionConfig implements DecompositionConfig {
  metadataName: string;
  isGlobal: boolean;
  isEmptyContainer: boolean;
  useSparseComposition: boolean;
  decompositions: DecomposedSubtypeConfig[];
  strategy: string;
  workspaceStrategy: string;
  commitStrategy: string;
  contentStrategy: string;

  constructor(metadataName: string, isGlobal: boolean, isEmptyContainer: boolean) {
    this.strategy = 'describeMetadata';
    this.workspaceStrategy = 'folderPerSubtype';
    this.commitStrategy = 'virtualDecomposition';
    this.contentStrategy = 'N/A';
    this.metadataName = metadataName;
    this.isGlobal = isGlobal;
    this.isEmptyContainer = isEmptyContainer;
    this.useSparseComposition = false;
    this.decompositions = [];
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DecompositionConfig, DecomposedSubtypeConfig } from './decompositionConfig';

/**
 * Subtype configuration for the describeMetadata decomposition.
 */
export class DescribeMetadataDecomposedSubtypeConfig implements DecomposedSubtypeConfig {
  metadataName: string;
  ext: string;
  hasStandardMembers: boolean;
  isAddressable: boolean;

  defaultDirectory: string;
  metadataEntityNameElement: string;
  xmlFragmentName: string;
}

/**
 * Decomposition configuration for the describeMetadata decomposition and the folder per subtype
 * workspace manifestation.
 */
export class DescribeMetadataDecompositionConfig implements DecompositionConfig {
  metadataName: string;
  isGlobal: boolean;
  isEmptyContainer: boolean;
  useSparseComposition: boolean;
  decompositions: DecomposedSubtypeConfig[];
  strategy: string;
  workspaceStrategy: string;
  commitStrategy: string;
  contentStrategy: string;

  constructor(metadataName: string, isGlobal: boolean, isEmptyContainer: boolean, useSparseComposition?: boolean) {
    this.strategy = 'describeMetadata';
    this.workspaceStrategy = 'folderPerSubtype';
    this.commitStrategy = 'fineGrainTracking';
    this.contentStrategy = 'N/A';
    this.metadataName = metadataName;
    this.isGlobal = isGlobal;
    this.isEmptyContainer = isEmptyContainer;
    this.useSparseComposition = useSparseComposition;
    this.decompositions = [];
  }
}

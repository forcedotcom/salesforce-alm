/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * The minimum configuration for a metadata entity subtype (eg. CustomField).
 */
export interface DecomposedSubtypeConfig {
  metadataName: string; // Name of the metadata subtype (eg. CustomField)
  ext: string; // The normal file extension (eg. field)
  defaultDirectory: string; // The default directory (eg. fields)
  hasStandardMembers: boolean; // Does this subtype have standard members (eg. CustomField)?
  isAddressable: boolean; // Can this subtype be addressed individually by mdapi?
}

/**
 * The minimum configuration for a decomposition. Each decomposed type has a single configuration associated
 * with it in the metadata repository. This configuration (and any extension) drives the runtime behavior of
 * decomposition.
 */
export interface DecompositionConfig {
  metadataName: string; // Name of the aggregate metadata entity (eg. CustomObject)
  isGlobal: boolean; // Is this a global (singleton) metadata entity (eg. CustomLabels)?
  isEmptyContainer: boolean; // Is there anything left to represent once the subtypes are extracted?
  decompositions: DecomposedSubtypeConfig[]; // List of subtype decomposition configurations. DO NOT leave undefined!
  strategy: string; // Name of the strategy for decomposition of the raw metadata.
  workspaceStrategy: string; // Name of the strategy for manifesting the decomposition in the workspace.
  commitStrategy: string; // Name of the strategy for handling additions, deletions and updates.
  contentStrategy: string;
  useSparseComposition: boolean; // Like CustomObject, where (eg) fields can be combined into a CustomObject w/o any root data
}

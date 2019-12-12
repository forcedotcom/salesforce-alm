/*
 * Copyright (c) 2018, Salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root  or https://opensource.org/licenses/BSD-3-Clause
 */
import { DecompositionConfig, DecomposedSubtypeConfig } from './decompositionConfig';

/**
 * Config for ExperienceBundle. Uses nonDecomposed strategy except for content strategy
 */
export class ExperienceBundleDecompositionStrategyConfig implements DecompositionConfig {
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
    this.strategy = 'nonDecomposed';
    this.workspaceStrategy = 'nonDecomposed';
    this.commitStrategy = 'fineGrainTracking';
    this.metadataName = metadataName;
    this.isGlobal = isGlobal;
    this.isEmptyContainer = isEmptyContainer;
    this.useSparseComposition = false;
    this.decompositions = [];
    this.contentStrategy = 'experienceBundleStrategy';
  }
}

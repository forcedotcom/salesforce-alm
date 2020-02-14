/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StaticResourceContentStrategy } from './staticResourceContentStrategy';

import { DecompositionConfig } from './decompositionConfig';
import { DecompositionStrategy } from './decompositionStrategy';
import { DescribeMetadataDecomposition } from './describeMetadataDecomposition';
import { DecompositionWorkspaceStrategy } from './decompositionWorkspaceStrategy';
import { FolderPerSubtypeWorkspaceDecomposition } from './folderPerSubtypeWorkspaceDecomposition';
import { DecompositionCommitStrategy } from './decompositionCommitStrategy';
import { FineGrainTrackingCommitStrategy } from './fineGrainTrackingCommitStrategy';
import { VirtualDecompositionCommitStrategy } from './virtualDecompositionCommitStrategy';
import { NonDecomposedWorkspaceStrategy } from './nonDecomposedWorkspaceStrategy';
import { NonDecomposedContentStrategy } from './nonDecomposedContentStrategy';
import { NonDecomposedMetadataStrategy } from './nonDecomposedMetadataStrategy';
import { ContentDecompositionStrategy } from './contentDecompositionStrategy';
import { InFolderMetadataWorkspaceDecomposition } from './inFolderMetadataWorkspaceDecomposition';
import { MetadataType } from '../metadataType';
import { ExperienceBundleContentStrategy } from './experienceBundleContentStrategy';

/**
 * Factory to instantiate a decomposition strategy given the strategy name.
 * Hopefully we will get a better DI infrastructure at some point.
 */
export class DecompositionStrategyFactory {
  static newDecompositionStrategy(config: DecompositionConfig): DecompositionStrategy {
    if (config.strategy === 'describeMetadata') {
      return new DescribeMetadataDecomposition(config);
    } else if (config.strategy === 'nonDecomposed') {
      return new NonDecomposedMetadataStrategy(config);
    }
    return new NonDecomposedMetadataStrategy(config); //default
  }

  static newDecompositionWorkspaceStrategy(config: DecompositionConfig): DecompositionWorkspaceStrategy {
    if (config.workspaceStrategy === 'folderPerSubtype') {
      return new FolderPerSubtypeWorkspaceDecomposition(config);
    }
    if (config.workspaceStrategy === 'inFolderMetadataType') {
      return new InFolderMetadataWorkspaceDecomposition();
    }
    if (config.workspaceStrategy === 'nonDecomposed') {
      return new NonDecomposedWorkspaceStrategy();
    }
    return new FolderPerSubtypeWorkspaceDecomposition(config); //default
  }

  static newDecompositionCommitStrategy(config: DecompositionConfig): DecompositionCommitStrategy {
    if (config.commitStrategy === 'fineGrainTracking') {
      return new FineGrainTrackingCommitStrategy(config);
    }
    if (config.commitStrategy === 'virtualDecomposition') {
      return new VirtualDecompositionCommitStrategy(config);
    }
    return new FineGrainTrackingCommitStrategy(config); //default
  }

  static newContentStrategy(
    metadataType: MetadataType,
    metadataRegistry,
    workspaceVersion
  ): ContentDecompositionStrategy {
    if (metadataType.getDecompositionConfig().contentStrategy === 'nonDecomposedContent') {
      return new NonDecomposedContentStrategy(metadataType, metadataRegistry, workspaceVersion);
    } else if (metadataType.getDecompositionConfig().contentStrategy === 'staticResource') {
      return new StaticResourceContentStrategy(metadataType, metadataRegistry, workspaceVersion);
    } else if (metadataType.getDecompositionConfig().contentStrategy === 'experienceBundleStrategy') {
      return new ExperienceBundleContentStrategy(metadataType, metadataRegistry, workspaceVersion);
    }
    return null;
  }
}

import { DecompositionConfig, DecomposedSubtypeConfig } from './decompositionConfig';

/**
 *  Decomposition configuration for metadata types that do not require any content or metadata decompositions
 */
export class NonDecomposedContentAndMetadataDecompositionConfig implements DecompositionConfig {
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
    this.contentStrategy = 'nonDecomposedContent';
  }
}

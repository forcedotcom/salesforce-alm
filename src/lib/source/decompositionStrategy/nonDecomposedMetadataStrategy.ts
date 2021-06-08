/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { MetadataDocument } from '../metadataDocument';
import { XmlMetadataDocument } from '../xmlMetadataDocument';
import { DecompositionConfig, DecomposedSubtypeConfig } from './decompositionConfig';
import { DecompositionStrategy } from './decompositionStrategy';

/**
 * Null decomposition strategy.
 */
export class NonDecomposedMetadataStrategy implements DecompositionStrategy {
  decompositionConfig: DecompositionConfig;

  constructor(decompositionConfig: DecompositionConfig) {
    this.decompositionConfig = decompositionConfig;
  }

  newContainerDocument(metadataName: string): MetadataDocument {
    return new XmlMetadataDocument(metadataName);
  }

  newDecompositionDocument(metadataName: string): MetadataDocument {
    return new XmlMetadataDocument(metadataName);
  }

  newComposedDocument(metadataName: string): MetadataDocument {
    return new XmlMetadataDocument(metadataName);
  }

  compose(
    container: MetadataDocument,
    decompositions: Map<DecomposedSubtypeConfig, MetadataDocument[]>
  ): MetadataDocument {
    return container;
  }

  decompose(
    composed: MetadataDocument,
    name: string,
    manifest?
  ): [MetadataDocument, Map<DecomposedSubtypeConfig, MetadataDocument[]>] {
    return [composed, new Map<DecomposedSubtypeConfig, MetadataDocument[]>()];
  }

  isComposable(): boolean {
    return false;
  }
}

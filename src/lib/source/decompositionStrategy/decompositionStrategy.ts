/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataDocument } from '../metadataDocument';
import { DecomposedSubtypeConfig } from './decompositionConfig';

/**
 * The contract for any strategy implementing decomposition of an aggregate metadata entity.
 *
 * This strategy is about the interpretation and structure of the metadata only. How that
 * metadata is represented in the workspace is not the concern of any implementing strategy.
 *
 * Please note that there is no assumption here about the nature of either the aggregate metadata
 * entity (typically mdapi xml) or the decomposed subtypes (typically mdapi xml). Any such decisions
 * are the responsibility of the implementing strategy. For example, an aggregated mdapi xml file
 * might be decomposed into dsl or json files, or the aggregated file might come from a source
 * other than mdapi.
 */
export interface DecompositionStrategy {
  /**
   * Returns a minimal document of the appropriate character for the purpose of holding
   * any data from the aggregate entity other than that decomposed into subtype documents
   * (eg. actionOverrides, nameField etc).
   *
   * @param metadataName the name of the aggregated metadata entity (eg. CustomObject)
   */
  newContainerDocument(metadataName: string): MetadataDocument;

  /**
   * Returns a minimal document of the appropriate character for the purpose of holding
   * subtype metadata (eg. CustomField).
   *
   * @param metadataName the name of the decomposed metadata entity (eg. CustomField)
   */
  newDecompositionDocument(metadataName: string): MetadataDocument;

  /**
   * Returns a minimal document of the appropriate character for the purpose of holding
   * the aggregate metadata after a re-composition.
   *
   * @param metadataName the name of the aggregated metadata entity (eg. CustomObject)
   */
  newComposedDocument(metadataName: string): MetadataDocument;

  /**
   * Composes an aggregate metadata document from its decomposed documents.
   *
   * @param container a document containing any data from the aggregate entity other than that
   * decomposed into subtype documents
   * @param decompositions documents containing subtype metadata
   */
  compose(
    container: MetadataDocument,
    decompositions: Map<DecomposedSubtypeConfig, MetadataDocument[]>
  ): MetadataDocument;

  /**
   * Decomposes an aggregate metadata document into its appropriate decomposed documents.
   *
   * @param composed an aggregate metadata document.
   * @param name the name of the aggregate entity (eg. Account).
   * @param manifest JSON representation of the mdapi manifest
   */
  decompose(
    composed: MetadataDocument,
    name: string,
    manifest?,
    metadataType?
  ): [MetadataDocument, Map<DecomposedSubtypeConfig, MetadataDocument[]>];

  /**
   * Returns whether this strategy implementation is for an aggregate metadata document that requires re-composition.
   */
  isComposable(): boolean;
}

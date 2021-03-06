/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * An arbitrary memo of document interpretation.
 */
export interface MetadataDocumentAnnotation {
  name: string;
}

/**
 * Core abstraction for a metadata entity or subtype used by
 * decomposition.
 *
 * Note that there is absolutely no assumption about the nature of either
 * the internal memory structure of the document (though often a DOM document)
 * or the external representation for storage on the file system (though
 * often XML). The external representation <b>is</b> assumed to be utf8 however.
 */
export interface MetadataDocument {
  data: any;
  annotation: MetadataDocumentAnnotation;

  getRepresentation(): string;
  setRepresentation(representation: string): void;

  getAnnotation(): MetadataDocumentAnnotation;
  setAnnotation(annotation: MetadataDocumentAnnotation): void;

  isEquivalent(doc: MetadataDocument): boolean;
  isEquivalentTo(representation: string): boolean;
}

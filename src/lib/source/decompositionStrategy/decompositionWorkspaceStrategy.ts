/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DecomposedSubtypeConfig } from './decompositionConfig';
import { MetadataDocumentAnnotation } from '../metadataDocument';

/**
 * The contract for any strategy implementing a workspace manifestation of a decomposition.
 *
 * This strategy is about how decomposed metadata is manifested in the workspace.
 * The content of the files is the responsibility of a DecompositionStrategy implementation.
 */
export interface DecompositionWorkspaceStrategy {
  getDecomposedFileName(
    annotation: MetadataDocumentAnnotation,
    decomposedSubtypeConfig: DecomposedSubtypeConfig
  ): string;

  /**
   * Gets the path for a container file - ie. a file containing any root level metadata
   * that is not part of any decomposed subtype (eg. actionOverrides for CustomObject).
   *
   * @param metadataFilePath the workspace path that would be in use if this type were not transformed.
   * The locations of the actual decomposed files can be inferred from this name. This is a proxy for all
   * of decomposed files.
   * @param ext the extension for files of this type
   */
  getContainerPath(metadataFilePath: string, ext: string): string;

  /**
   * Finds any existing decomposed file paths for the given metadata entity.
   *
   * @param metadataFilePath the workspace path that would be in use if this type were not transformed.
   * The locations of the actual decomposed files can be inferred from this name. This is a proxy for all
   * of decomposed files.
   * @param ext the extension for files of this type
   */
  findDecomposedPaths(metadataFilePath: string, ext: string): Map<DecomposedSubtypeConfig, string[]>;

  /**
   * Gets the directory for metadata of a particular subtype for the given entity proxy and subtype.
   *
   * @param metadataFilePath the workspace path that would be in use if this type were not transformed.
   * The locations of the actual decomposed files can be inferred from this name. This is a proxy for all
   * of decomposed files.
   * @param ext the extension for files of this type
   * @param decomposedSubtypeConfig the decomposition configuration for this subtype
   */
  getDecomposedSubtypeDirFromMetadataFile(
    metadataFilePath: string,
    ext: string,
    decomposedSubtypeConfig: DecomposedSubtypeConfig
  ): string;
}

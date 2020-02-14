/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DecompositionWorkspaceStrategy } from './decompositionWorkspaceStrategy';
import { DecomposedSubtypeConfig } from './decompositionConfig';

/**
 * Workspace decomposition strategy where metadata files do not require decomposition
 */

export class NonDecomposedWorkspaceStrategy implements DecompositionWorkspaceStrategy {
  /**
   * Returns null because this strategy has no decompositions
   * @param annotation
   * @param decomposedSubtypeConfig
   * @returns {null}
   */
  getDecomposedFileName(annotation, decomposedSubtypeConfig) {
    return null;
  }

  /**
   * For non-decomposed source, the metadata file path is also the container path
   * @param metadataFilePath
   * @param ext
   * @returns {any}
   */
  getContainerPath(metadataFilePath, ext) {
    return metadataFilePath;
  }

  /**
   * Returns an empty map because this strategy has no decompositions
   * @param metadataFilePath
   * @param ext
   * @returns {Map<DecomposedSubtypeConfig, string[]>}
   */
  findDecomposedPaths(metadataFilePath, ext) {
    return new Map<DecomposedSubtypeConfig, string[]>();
  }

  /**
   * Returns null because this strategy has no decompositions
   * @param metadataFilePath
   * @param ext
   * @param decomposedSubtypeConfig
   * @returns {null}
   */
  getDecomposedSubtypeDirFromMetadataFile(metadataFilePath, ext, decomposedSubtypeConfig) {
    return null;
  }
}

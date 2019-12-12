/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DecompositionWorkspaceStrategy } from './decompositionWorkspaceStrategy';
import { DecomposedSubtypeConfig } from './decompositionConfig';
import { MetadataDocumentAnnotation } from '../metadataDocument';

export class InFolderMetadataWorkspaceDecomposition implements DecompositionWorkspaceStrategy {
  getDecomposedFileName(
    annotation: MetadataDocumentAnnotation,
    decomposedSubtypeConfig: DecomposedSubtypeConfig
  ): string {
    return null;
  }

  getContainerPath(metadataFilePath: string, ext: string): string {
    return metadataFilePath;
  }

  findDecomposedPaths(metadataFilePath: string, ext: string): Map<DecomposedSubtypeConfig, string[]> {
    return new Map<DecomposedSubtypeConfig, string[]>();
  }

  getDecomposedSubtypeDirFromMetadataFile(
    metadataFilePath: string,
    ext: string,
    decomposedSubtypeConfig: DecomposedSubtypeConfig
  ): string {
    return null;
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DecompositionWorkspaceStrategy } from './decompositionWorkspaceStrategy';
import { DecomposedSubtypeConfig } from './decompositionConfig';
import { MetadataDocumentAnnotation } from '../metadataDocument';
import { Nullable } from '@salesforce/ts-types';

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
  ): Nullable<string> {
    return null;
  }

  getDecomposedSubtypeDirFromAnnotation(
    annotation: MetadataDocumentAnnotation,
    metadataType: string,
    aggregateFullName: string,
    decomposedSubtypeConfig: DecomposedSubtypeConfig
  ): Nullable<string> {
    return null;
  }
}

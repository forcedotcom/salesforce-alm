/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { InFolderDecompositionConfig } from './inFolderDecompositionConfig';
import { CustomObjectTranslationDecompositionConfig } from './customObjectTranslationDecompositionConfig';
import { DescribeMetadataDecompositionConfig } from './describeMetadataDecompositionConfig';
import { NonDecomposedContentAndMetadataDecompositionConfig } from './nonDecomposedContentAndMetadataDecompositionConfig';
import { StaticResourceDecompositionConfig } from './staticResourceDecompositionConfig';
import { DecompositionConfig } from './decompositionConfig';
import { TypeDefObj } from '../typeDefObj';
import { ExperienceBundleDecompositionStrategyConfig } from './experienceBundleDecompositionStrategyConfig';

export class DecompositionConfigFactory {
  static getDecompositionConfig(typeDefObj: TypeDefObj): DecompositionConfig {
    if (typeDefObj.inFolder) {
      return new InFolderDecompositionConfig(typeDefObj.metadataName, typeDefObj.isGlobal, typeDefObj.isEmptyContainer);
    }

    switch (typeDefObj.metadataName) {
      case 'CustomObjectTranslation':
        return new CustomObjectTranslationDecompositionConfig(
          typeDefObj.metadataName,
          typeDefObj.isGlobal,
          typeDefObj.isEmptyContainer
        );
      case 'Bot':
      case 'CustomObject':
        return new DescribeMetadataDecompositionConfig(
          typeDefObj.metadataName,
          typeDefObj.isGlobal,
          typeDefObj.isEmptyContainer,
          true
        );
      case 'StaticResource':
        return new StaticResourceDecompositionConfig(
          typeDefObj.metadataName,
          typeDefObj.isGlobal,
          typeDefObj.isEmptyContainer
        );
      case 'ExperienceBundle':
        return new ExperienceBundleDecompositionStrategyConfig(
          typeDefObj.metadataName,
          typeDefObj.isGlobal,
          typeDefObj.isEmptyContainer
        );
      default:
        return new NonDecomposedContentAndMetadataDecompositionConfig(
          typeDefObj.metadataName,
          typeDefObj.isGlobal,
          typeDefObj.isEmptyContainer
        );
    }
  }
}

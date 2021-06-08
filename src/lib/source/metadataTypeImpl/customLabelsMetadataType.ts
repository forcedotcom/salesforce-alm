/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { NondecomposedTypesWithChildrenMetadataType } from './nondecomposedTypesWithChildrenMetadataType';
import { SourceLocations } from '../sourceLocations';

export class CustomLabelsMetadataType extends NondecomposedTypesWithChildrenMetadataType {
  parseSourceMemberForMetadataRetrieve(
    sourceMemberName: string,
    sourceMemberType: string,
    isNameObsolete: boolean
  ): any {
    return {
      fullName: sourceMemberName,
      type: sourceMemberType,
      isNameObsolete,
    };
  }

  // if name is singular 'CustomLabel' and there are no other entries in the nonDecomposedElementsIndex then we should delete the file
  // e.g. we're deleting the last CustomLabel entry in the CustomLabels file
  shouldDeleteWorkspaceAggregate(metadataType: string): boolean {
    if (metadataType === 'CustomLabel') {
      return SourceLocations.nonDecomposedElementsIndex.values().length === 1;
    } else {
      return metadataType === this.getAggregateMetadataName();
    }
  }
}

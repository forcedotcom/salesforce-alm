/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { NondecomposedTypesWithChildrenMetadataType } from './nondecomposedTypesWithChildrenMetadataType';

export class CustomLabelsMetadataType extends NondecomposedTypesWithChildrenMetadataType {
  parseSourceMemberForMetadataRetrieve(
    sourceMemberName: string,
    sourceMemberType: string,
    isNameObsolete: boolean
  ): any {
    if (sourceMemberType === 'CustomLabel') {
      // CustomLabels are not decomposed, so deletions of child types are part of changes to the larger parent container
      return { fullName: `*`, type: this.getMetadataName() };
    }
    return {
      fullName: sourceMemberName,
      type: sourceMemberType,
      isNameObsolete
    };
  }
}

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { NondecomposedTypesWithChildrenMetadataType } from './nondecomposedTypesWithChildrenMetadataType';

export class SharingRulesMetadataType extends NondecomposedTypesWithChildrenMetadataType {
  /**
   * Sharing rules are tracked at the fine-grained level on the server, but they are nondecomposed in the workspace
   * If a child of a sharing rule type has been changed on the server, this corresponds to the aggregate file in the workspace
   *
   * @param {string} sourceMemberFullName
   * @param {string} workspaceFullName
   * @returns {boolean}
   */
  sourceMemberFullNameCorrespondsWithWorkspaceFullName(
    sourceMemberFullName: string,
    workspaceFullName: string
  ): boolean {
    return sourceMemberFullName.split('.')[0] === workspaceFullName;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDisplayNameForRemoteChange(sourceMemberType: string): string {
    return this.typeDefObj.metadataName;
  }

  parseSourceMemberForMetadataRetrieve(
    sourceMemberName: string,
    sourceMemberType: string,
    isNameObsolete: boolean
  ): any {
    if (
      sourceMemberType === 'SharingOwnerRule' ||
      sourceMemberType === 'SharingCriteriaRule' ||
      sourceMemberType === 'SharingGuestRule' ||
      sourceMemberType === 'SharingTerritoryRule'
    ) {
      const fullName = this.getAggregateFullNameFromSourceMemberName(sourceMemberName);
      // these types are not decomposed, so deletions of child types are part of changes to the larger parent container
      return { fullName: `${fullName}.*`, type: sourceMemberType };
    }
    return {
      fullName: sourceMemberName,
      type: sourceMemberType,
      isNameObsolete,
    };
  }
}

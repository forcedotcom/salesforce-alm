/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DefaultMetadataType } from './defaultMetadataType';

/**
 * Class to represent types that have childXmlNames, but are not decomposed
 * Since the child types are not decomposed into individual files in the workspace,
 * we do not have MetadataType representations for the child types themselves,
 * and any metadataType specific logic for those child types is handled in this class
 */
export class NondecomposedTypesWithChildrenMetadataType extends DefaultMetadataType {
  requiresIndividuallyAddressableMembersInPackage(): boolean {
    return true;
  }

  getAggregateFullNameFromSourceMemberName(sourceMemberName): string {
    return sourceMemberName.split('.').length == 1 ? this.getMetadataName() : sourceMemberName.split('.')[0]; //if only passed the name, return the type
  }

  /**
   * @param {string} sourceMemberType - could be the name of the Nondecomposed type itself (i.e. EscalationRules) or
   * the name of a child type (i.e. Escalation Rule (singular))
   * @returns {string}
   */
  getDisplayNameForRemoteChange(sourceMemberType: string): string {
    if (sourceMemberType !== this.typeDefObj.metadataName) {
      return sourceMemberType;
    }
    return this.typeDefObj.metadataName;
  }

  parseSourceMemberForMetadataRetrieve(
    sourceMemberName: string,
    sourceMemberType: string,
    isNameObsolete: boolean
  ): any {
    const fullName = this.getAggregateFullNameFromSourceMemberName(sourceMemberName);
    // these types are not decomposed, so deletions of child types are part of changes to the larger parent container
    return { fullName, type: this.getMetadataName() };
  }
}

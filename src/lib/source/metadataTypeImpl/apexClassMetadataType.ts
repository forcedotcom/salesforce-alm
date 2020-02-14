/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DefaultMetadataType } from './defaultMetadataType';

export class ApexClassMetadataType extends DefaultMetadataType {
  getAggregateFullNameFromComponentFailure(componentFailure): string {
    // Sometimes, the fullNames of ApexClass failures look like:
    // 'classes/DreamHouseSampleDataController.cls-meta.xml'
    // so get the fullName from the fileName instead
    return this.getAggregateFullNameFromFilePath(componentFailure.fileName);
  }
}

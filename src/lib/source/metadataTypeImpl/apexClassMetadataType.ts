/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

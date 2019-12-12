/*
 * Copyright (c) 2017, Salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DefaultMetadataType } from './defaultMetadataType';

export class SamlSsoConfigMetadataType extends DefaultMetadataType {
  getAggregateFullNameFromFileProperty(fileProperty, namespace: string) {
    if (namespace) {
      return fileProperty.fullName.replace(`${namespace}__`, '');
    }
    return fileProperty.fullName;
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

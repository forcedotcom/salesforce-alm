/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DefaultMetadataType } from './defaultMetadataType';
import { Messages } from '@salesforce/core';

export class FlowMetadataType extends DefaultMetadataType {
  getDeprecationMessage(fullName?: string) {
    if (/-[0-9]$/.test(fullName)) {
      Messages.importMessagesDirectory(__dirname);
      const messages = Messages.loadMessages('salesforce-alm', 'source');
      return messages.getMessage('flowDeprecation');
    }
  }
}

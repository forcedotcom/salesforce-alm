/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

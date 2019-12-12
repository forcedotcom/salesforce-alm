/*
 * Copyright (c) 2018, Salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DefaultMetadataType } from './defaultMetadataType';
import { Messages } from '@salesforce/core';

export class FlowDefinitionMetadataType extends DefaultMetadataType {
  getDeprecationMessage() {
    Messages.importMessagesDirectory(__dirname);
    const messages = Messages.loadMessages('salesforce-alm', 'source');
    return messages.getMessage('flowDefinitionDeprecation');
  }
}

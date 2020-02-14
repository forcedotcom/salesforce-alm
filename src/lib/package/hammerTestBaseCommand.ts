/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const { Messages } = require('@salesforce/core');

Messages.importMessagesDirectory(__dirname);
const hammertestMessages = Messages.loadMessages('salesforce-alm', 'package_hammertest');

class HammerTestBaseCommand {
  getHumanErrorMessage(error) {
    if (error.name == 'FUNCTIONALITY_NOT_ENABLED') {
      return hammertestMessages.getMessage('noPermError');
    }
    throw error;
  }
}

export = HammerTestBaseCommand;

/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

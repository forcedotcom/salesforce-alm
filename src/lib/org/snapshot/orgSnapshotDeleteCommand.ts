/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgSnapshotApiImpl } from './orgSnapshotApi';
import Messages = require('../../messages');
const messages = Messages();
import logger = require('../../core/logApi');

/**
 * Delete a Org Snapshot record.
 */
class OrgSnapshotDeleteCommand {
  private logger;
  private orgSnapshotIdOrName: string;

  constructor() {
    this.logger = logger.child('org:snapshot:delete');
  }

  execute(context) {
    // double-check
    if (!context.flags.snapshot) {
      throw new Error(messages.getMessage('snapshotInvalid', [], 'orgSnapshot'));
    }

    this.orgSnapshotIdOrName = context.flags.snapshot;
    return OrgSnapshotApiImpl.create(context.org).then(orgSnapshotApi =>
      orgSnapshotApi.delete(this.orgSnapshotIdOrName)
    );
  }

  /**
   * returns a human readable message for a cli output
   * @param result - the data representing the Org Snapshot
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    this.logger.log(`Successfully deleted snapshot ${this.orgSnapshotIdOrName}.`);
    return '';
  }
}

export = OrgSnapshotDeleteCommand;

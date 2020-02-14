/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgSnapshotApi, OrgSnapshotApiImpl, ColumnData } from './orgSnapshotApi';
import Messages = require('../../messages');
const messages = Messages();
import logger = require('../../core/logApi');

/**
 * Get a Org Snapshot record.
 */
class OrgSnapshotGetCommand {
  private logger;
  private orgSnapshotApi: OrgSnapshotApi;
  private orgSnapshotIdOrName: string;

  constructor() {
    this.logger = logger.child('org:snapshot:get');
  }

  execute(context) {
    // double-check
    if (!context.flags.snapshot) {
      throw new Error(messages.getMessage('snapshotInvalid', [], 'orgSnapshot'));
    }

    this.orgSnapshotIdOrName = context.flags.snapshot;
    return OrgSnapshotApiImpl.create(context.org).then(orgSnapshotApi => {
      this.orgSnapshotApi = orgSnapshotApi;
      return this.orgSnapshotApi.get(this.orgSnapshotIdOrName);
    });
  }

  /**
   * returns a human readable message for a cli output
   * @param result - the data representing the Org Snapshot
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    const data: ColumnData[] = this.orgSnapshotApi.mapDataToLabel(result);

    if (result.Status === 'Error') {
      data.push({ name: 'Error', value: result.Error || 'Unknown' });
    }

    this.logger.styledHeader(this.logger.color.blue('Org Snapshot'));
    this.logger.table(data, {
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'value', label: 'Value' }
      ]
    });

    return '';
  }
}

export = OrgSnapshotGetCommand;

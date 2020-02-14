/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgSnapshotApiImpl, ORG_SNAPSHOT_COLUMNS } from './orgSnapshotApi';
import logger = require('../../core/logApi');

/**
 * List Org Snapshots linked DevHub.
 */
class OrgSnapshotListCommand {
  private logger;
  private records;

  constructor() {
    this.logger = logger.child('org:snapshot:list');
    this.records = [];
  }

  execute(context) {
    return OrgSnapshotApiImpl.create(context.org)
      .then(orgSnapshotApi => orgSnapshotApi.list())
      .then(records => {
        this.records = records;
        return records;
      });
  }

  /**
   * returns a human readable message for a cli output
   * @param result - the data representing the Org Snapshot
   * @returns {string}
   */
  getColumnData() {
    this.logger.styledHeader(this.logger.color.blue(`Org Snapshots [${this.records.length}]`));
    return ORG_SNAPSHOT_COLUMNS;
  }
}

export = OrgSnapshotListCommand;

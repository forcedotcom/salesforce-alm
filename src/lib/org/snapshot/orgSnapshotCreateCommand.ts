/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as BBPromise from 'bluebird';
import { OrgSnapshotApi, OrgSnapshotApiImpl, ColumnData } from './orgSnapshotApi';
import Org = require('../../core/scratchOrgApi');
import Messages = require('../../messages');
const messages = Messages();
import logger = require('../../core/logApi');

/**
 * Create a snapshot of given scratch source org.
 */
class OrgSnapshotCreateCommand {
  private logger;
  private orgSnapshotApi: OrgSnapshotApi;

  constructor() {
    this.logger = logger.child('org:snapshot:create');
  }

  execute(context) {
    // double-check
    if (!context.flags.sourceorg) {
      throw new Error(messages.getMessage('sourceOrgInvalid', [], 'orgSnapshot'));
    }

    if (!context.flags.snapshotname) {
      throw new Error(messages.getMessage('nameInvalid', [], 'orgSnapshot'));
    }

    return this._getSourceOrgId(context).then(orgId => {
      return OrgSnapshotApiImpl.create(context.org).then(orgSnapshotApi => {
        this.orgSnapshotApi = orgSnapshotApi;
        return this.orgSnapshotApi.create({
          SourceOrg: orgId,
          SnapshotName: context.flags.snapshotname,
          Description: context.flags.description
        });
      });
    });
  }

  // resolve sourceorg to orgId
  _getSourceOrgId(context) {
    if (context.flags.sourceorg.startsWith('00D')) {
      return BBPromise.resolve(context.flags.sourceorg);
    } else {
      return Org.create(context.flags.sourceorg, Org.Defaults.USERNAME)
        .then(org => org.getConfig())
        .then(orgConfig => orgConfig.orgId);
    }
  }

  /**
   * returns a human readable message for a cli output
   * @param result - the data representing the Org Snapshot
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    const data: ColumnData[] = this.orgSnapshotApi.mapDataToLabel(result);

    if (result.Error) {
      data.push({ name: 'Error', value: result.Error });
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

export = OrgSnapshotCreateCommand;

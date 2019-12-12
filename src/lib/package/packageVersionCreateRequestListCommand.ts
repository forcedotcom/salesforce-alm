/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';

// Local
import Messages = require('../messages');
const messages = Messages();
import PackageVersionCreateRequestApi = require('./packageVersionCreateRequestApi');
import logger = require('../core/logApi');
import pkgUtils = require('./packageUtils');

class PackageVersionCreateRequestListCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('package:version:create:list');
  }

  execute(context) {
    return this._execute(context).catch(err => {
      // TODO
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      throw pkgUtils.applyErrorAction(err);
    });
  }

  _execute(context) {
    this.packageVersionCreateRequestApi = new PackageVersionCreateRequestApi(context.org.force, context.org);
    return this.packageVersionCreateRequestApi.list(context.flags).then(results => {
      this.cnt = util.isArray(results) ? results.length : 0;
      return results;
    });
  }

  /**
   * indicates that the human readable message should be tabular
   * @returns {[{}...]}
   */
  getColumnData() {
    this.logger.styledHeader(this.logger.color.blue(`Package Version Create Requests  [${this.cnt || 0}]`));
    const columnData = [
      { key: 'Id', label: 'Id' },
      {
        key: 'Status',
        label: messages.getMessage('status', [], 'package_version_create_list')
      },
      {
        key: 'Package2Id',
        label: messages.getMessage('packageId', [], 'package_version_create_list')
      },
      {
        key: 'Package2VersionId',
        label: messages.getMessage('packageVersionId', [], 'package_version_create_list')
      },
      {
        key: 'SubscriberPackageVersionId',
        label: messages.getMessage('subscriberPackageVersionId', [], 'package_version_create_list')
      },
      {
        key: 'Tag',
        label: messages.getMessage('tag', [], 'package_version_create_list')
      },
      {
        key: 'Branch',
        label: messages.getMessage('branch', [], 'package_version_create_list')
      },
      { key: 'CreatedDate', label: 'Created Date' }
    ];

    return columnData;
  }
}

export = PackageVersionCreateRequestListCommand;

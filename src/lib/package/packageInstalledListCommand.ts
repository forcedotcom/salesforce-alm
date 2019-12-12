/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import Messages = require('../messages');
const messages = Messages();
import logger = require('../core/logApi');
import pkgUtils = require('../package/packageUtils');

const QUERY =
  'SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, ' +
  'SubscriberPackageVersion.Id, SubscriberPackageVersion.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, ' +
  'SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber FROM InstalledSubscriberPackage ' +
  'ORDER BY SubscriberPackageId';

class packageInstalledListCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('package:installed:list');
    this.results = [];
  }

  execute(context) {
    return this._execute(context).catch(err => {
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      throw pkgUtils.applyErrorAction(err);
    });
  }

  _execute(context) {
    this.org = context.org;
    this.force = this.org.force;

    return this.force.toolingQuery(this.org, QUERY).then(queryResult => {
      const records = queryResult.records;
      if (records && records.length > 0) {
        records.forEach(record => {
          this.results.push({
            Id: record.Id,
            SubscriberPackageId: record.SubscriberPackageId,
            SubscriberPackageName: record.SubscriberPackage.Name,
            SubscriberPackageNamespace: record.SubscriberPackage.NamespacePrefix,
            SubscriberPackageVersionId: record.SubscriberPackageVersion.Id,
            SubscriberPackageVersionName: record.SubscriberPackageVersion.Name,
            SubscriberPackageVersionNumber: `${record.SubscriberPackageVersion.MajorVersion}.${
              record.SubscriberPackageVersion.MinorVersion
            }.${record.SubscriberPackageVersion.PatchVersion}.${record.SubscriberPackageVersion.BuildNumber}`
          });
        });
      }
      return this.results;
    });
  }

  /**
   * indicates that the human readable message should be tabular
   * @returns {[{}...]}
   */
  getColumnData() {
    this.logger.styledHeader(this.logger.color.blue(`Installed Package Versions [${this.results.length}]`));
    return [
      {
        key: 'Id',
        label: messages.getMessage('id', [], 'package_installed_list')
      },
      {
        key: 'SubscriberPackageId',
        label: messages.getMessage('subscriberPackageId', [], 'package_installed_list')
      },
      {
        key: 'SubscriberPackageName',
        label: messages.getMessage('subscriberPackageName', [], 'package_installed_list')
      },
      {
        key: 'SubscriberPackageNamespace',
        label: messages.getMessage('subscriberPackageNamespace', [], 'package_installed_list')
      },
      {
        key: 'SubscriberPackageVersionId',
        label: messages.getMessage('subscriberPackageVersionId', [], 'package_installed_list')
      },
      {
        key: 'SubscriberPackageVersionName',
        label: messages.getMessage('subscriberPackageVersionName', [], 'package_installed_list')
      },
      {
        key: 'SubscriberPackageVersionNumber',
        label: messages.getMessage('subscriberPackageVersionNumber', [], 'package_installed_list')
      }
    ];
  }
}

export = {
  packageInstalledListCommand,
  QUERY
};

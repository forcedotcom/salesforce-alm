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
import pkgUtils = require('./packageUtils');

const QUERY =
  'SELECT Id, SubscriberPackageId, Name, Description, NamespacePrefix, ContainerOptions ' +
  'FROM Package2 ' +
  'ORDER BY NamespacePrefix, Name';

class PackageListCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('package:list');
    this.results = [];
    this.verbose = false;
  }

  execute(context) {
    return this._execute(context).catch(err => {
      // TODO:
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      throw pkgUtils.applyErrorAction(err);
    });
  }

  _execute(context) {
    this.org = context.org;
    this.force = this.org.force;
    this.verbose = context.flags.verbose;

    return this.force.toolingQuery(this.org, QUERY).then(queryResult => {
      const records = queryResult.records;
      if (records && records.length > 0) {
        this.results = records.map(
          ({ Id, SubscriberPackageId, Name, Description, NamespacePrefix, ContainerOptions }) => {
            const aliases = pkgUtils.getPackageAliasesFromId(Id, this.force);
            const Alias = aliases.join();
            return {
              Id,
              SubscriberPackageId,
              Name,
              Description,
              NamespacePrefix,
              ContainerOptions,
              Alias
            };
          }
        );
      }
      return this.results;
    });
  }

  getColumnData() {
    this.logger.styledHeader(this.logger.color.blue(`Packages [${this.results.length}]`));
    const columns = [
      {
        key: 'NamespacePrefix',
        label: messages.getMessage('namespace', [], 'package_list')
      },
      { key: 'Name', label: messages.getMessage('name', [], 'package_list') },
      { key: 'Id', label: messages.getMessage('id', [], 'package_list') },
      { key: 'Alias', label: messages.getMessage('alias', [], 'package_list') },
      {
        key: 'Description',
        label: messages.getMessage('description', [], 'package_list')
      },
      {
        key: 'ContainerOptions',
        label: messages.getMessage('packageType', [], 'package_list')
      }
    ];

    if (this.verbose) {
      columns.push({
        key: 'SubscriberPackageId',
        label: messages.getMessage('packageId', [], 'package_list')
      });
    }

    return columns;
  }
}

export = PackageListCommand;

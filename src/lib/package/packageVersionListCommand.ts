/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as moment from 'moment';
import * as _ from 'lodash';
import * as util from 'util';

// Local
import Messages = require('../messages');
const messages = Messages();
import logger = require('../core/logApi');
import pkgUtils = require('./packageUtils');

// Stripping CodeCoverage, HasPassedCodeCoverageCheck as they are causing a perf issue in 47.0+ W-6997762
const DEFAULT_SELECT =
  'SELECT Id, Package2Id, SubscriberPackageVersionId, Name, Package2.Name, Package2.NamespacePrefix, ' +
  'Description, Tag, Branch, MajorVersion, MinorVersion, PatchVersion, BuildNumber, IsReleased, ' +
  'CreatedDate, LastModifiedDate, IsPasswordProtected, AncestorId, ValidationSkipped ' +
  'FROM Package2Version';

const VERBOSE_SELECT =
  'SELECT Id, Package2Id, SubscriberPackageVersionId, Name, Package2.Name, Package2.NamespacePrefix, ' +
  'Description, Tag, Branch, MajorVersion, MinorVersion, PatchVersion, BuildNumber, IsReleased, ' +
  'CreatedDate, LastModifiedDate, IsPasswordProtected, AncestorId, ValidationSkipped, ConvertedFromVersionId, Package2.IsOrgDependent ' +
  'FROM Package2Version';

const DEFAULT_ORDER_BY_FIELDS = 'Package2Id, Branch, MajorVersion, MinorVersion, PatchVersion, BuildNumber';

class PackageVersionListCommand {
  static DEFAULT_SELECT = DEFAULT_SELECT;
  static VERBOSE_SELECT = VERBOSE_SELECT;
  static DEFAULT_ORDER_BY_FIELDS = DEFAULT_ORDER_BY_FIELDS;

  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('package:version:list');
    this.results = [];
    this.verbose = false;
    this.concise = false;
  }

  execute(context) {
    return this._execute(context).catch(err => {
      // TODO
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      throw pkgUtils.applyErrorAction(err);
    });
  }

  _execute(context) {
    this.org = context.org;
    this.force = context.org.force;
    this.verbose = context.flags.verbose;
    this.concise = context.flags.concise;

    return this.force.toolingQuery(this.org, this._constructQuery(context.flags)).then(async queryResult => {
      const records = queryResult.records;
      if (records && records.length > 0) {
        let ancestorVersionsMap;
        let containerOptionsMap;
        // lookup ancestorVersions if ancestorIds are present
        const ancestorIds = records
          .filter(record => {
            return record.AncestorId;
          })
          .map(record => record.AncestorId);
        if (ancestorIds && ancestorIds.length > 0) {
          ancestorVersionsMap = await pkgUtils.getPackageVersionStrings(ancestorIds, this.force, this.org);
        }

        // Get the container options for each package version. We need this for determining if the version is OrgDependent
        const recordIds = [...new Set(records.map(record => record.Package2Id))];
        containerOptionsMap = await pkgUtils.getContainerOptions(recordIds, this.force, this.org);

        records.forEach(record => {
          const ids = [record.Id, record.SubscriberPackageVersionId];
          const aliases = [];
          ids.forEach(id => {
            const matches = pkgUtils.getPackageAliasesFromId(id, this.force);
            if (matches.length > 0) {
              aliases.push(matches);
            }
          });
          const AliasStr = aliases.length > 0 ? aliases.join() : '';

          // set Ancestor display values
          let ancestorVersion = null;
          if (record.AncestorId) {
            ancestorVersion = ancestorVersionsMap.get(record.AncestorId);
          } else if (containerOptionsMap.get(record.Package2Id) !== 'Managed') {
            // display N/A if package is unlocked
            ancestorVersion = 'N/A';
            record.AncestorId = 'N/A';
          }

          let isOrgDependent =
            containerOptionsMap.get(record.Package2Id) === 'Managed'
              ? 'N/A'
              : record.Package2.IsOrgDependent === true
              ? 'Yes'
              : 'No';

          this.results.push({
            Package2Id: record.Package2Id,
            Branch: record.Branch,
            Tag: record.Tag,
            MajorVersion: record.MajorVersion,
            MinorVersion: record.MinorVersion,
            PatchVersion: record.PatchVersion,
            BuildNumber: record.BuildNumber,
            Id: record.Id,
            SubscriberPackageVersionId: record.SubscriberPackageVersionId,
            ConvertedFromVersionId: record.ConvertedFromVersionId,
            Name: record.Name,
            NamespacePrefix: record.Package2.NamespacePrefix,
            Package2Name: record.Package2.Name,
            Description: record.Description,
            Version: [record.MajorVersion, record.MinorVersion, record.PatchVersion, record.BuildNumber].join('.'),
            // Table output needs string false to display 'false'
            IsPasswordProtected: context.flags.json
              ? record.IsPasswordProtected
              : record.IsPasswordProtected.toString(),
            IsReleased: context.flags.json ? record.IsReleased : record.IsReleased.toString(),
            CreatedDate: moment(record.CreatedDate).format('YYYY-MM-DD HH:mm'),
            LastModifiedDate: moment(record.LastModifiedDate).format('YYYY-MM-DD HH:mm'),
            InstallUrl: pkgUtils.INSTALL_URL_BASE + record.SubscriberPackageVersionId,
            CodeCoverage: 'Data unavailable',
            HasPassedCodeCoverageCheck: 'Data unavailable',
            ValidationSkipped: record.ValidationSkipped,
            AncestorId: record.AncestorId,
            AncestorVersion: ancestorVersion,
            Alias: AliasStr,
            IsOrgDependent: isOrgDependent
          });
        });
      }
      return this.results;
    });
  }

  _getLastDays(paramName, lastDays) {
    if (isNaN(lastDays)) {
      throw new Error(messages.getMessage('invalidDaysNumber', paramName, 'packaging'));
    }

    if (parseInt(lastDays, 10) < 0) {
      throw new Error(messages.getMessage('invalidDaysNumber', paramName, 'packaging'));
    }

    return lastDays;
  }

  // construct custom WHERE clause parts
  _constructWhere(idsOrAliases, createdLastDays, lastModLastDays) {
    const where = [];

    // filter on given package ids
    if (idsOrAliases) {
      // split and remove dups
      if (util.isString(idsOrAliases)) {
        idsOrAliases = idsOrAliases.split(',');
      }
      idsOrAliases = _.uniq(idsOrAliases);

      // resolve any aliases
      const packageIds = idsOrAliases.map(idOrAlias => pkgUtils.getPackageIdFromAlias(idOrAlias, this.force));

      // validate ids
      packageIds.forEach(packageid => {
        pkgUtils.validateId(pkgUtils.BY_LABEL.PACKAGE_ID, packageid);
      });

      // stash where part
      if (packageIds.length > 1) {
        where.push(`Package2Id IN ('${packageIds.join("','")}')`);
      } else {
        where.push(`Package2Id = '${packageIds[0]}'`);
      }
    }

    // filter on created date, days ago: 0 for today, etc
    if (!util.isNullOrUndefined(createdLastDays)) {
      createdLastDays = this._getLastDays('createdlastdays', createdLastDays);
      where.push(`CreatedDate = LAST_N_DAYS:${createdLastDays}`);
    }

    // filter on last mod date, days ago: 0 for today, etc
    if (!util.isNullOrUndefined(lastModLastDays)) {
      lastModLastDays = this._getLastDays('modifiedlastdays', lastModLastDays);
      where.push(`LastModifiedDate = LAST_N_DAYS:${lastModLastDays}`);
    }

    return where;
  }

  // assemble query
  _assembleQueryParts(select, where = [], orderBy = '') {
    let wherePart = '';
    if (where.length > 0) {
      wherePart = ` WHERE ${where.join(' AND ')}`;
    }

    const query = `${select}${wherePart}${orderBy}`;
    logger.debug(query);
    return query;
  }

  // construct query based on given params
  _constructQuery(flags: any = {}) {
    // construct custom WHERE clause, if applicable
    const where = this._constructWhere(flags.packages, flags.createdlastdays, flags.modifiedlastdays);
    if (flags.released) {
      where.push('IsReleased = true');
    }

    // construct ORDER BY clause
    // TODO: validate given fields
    const orderBy = ` ORDER BY ${flags.orderby ? flags.orderby : DEFAULT_ORDER_BY_FIELDS}`;
    return this._assembleQueryParts(flags.verbose === true ? VERBOSE_SELECT : DEFAULT_SELECT, where, orderBy);
  }

  /**
   * indicates that the human readable message should be tabular
   * @returns {[{}...]}
   */
  getColumnData() {
    this.logger.styledHeader(this.logger.color.blue(`Package Versions [${this.results.length}]`));

    if (this.concise) {
      return [
        {
          key: 'Package2Id',
          label: messages.getMessage('packageId', [], 'package_version_list')
        },
        {
          key: 'Version',
          label: messages.getMessage('version', [], 'package_version_list')
        },
        {
          key: 'SubscriberPackageVersionId',
          label: messages.getMessage('subscriberPackageVersionId', [], 'package_version_list')
        },
        { key: 'IsReleased', label: 'Released' }
      ];
    }

    const columns = [
      { key: 'Package2Name', label: 'Package Name' },
      { key: 'NamespacePrefix', label: 'Namespace' },
      { key: 'Name', label: 'Version Name' },
      {
        key: 'Version',
        label: messages.getMessage('version', [], 'package_version_list')
      },
      {
        key: 'SubscriberPackageVersionId',
        label: messages.getMessage('subscriberPackageVersionId', [], 'package_version_list')
      },
      {
        key: 'Alias',
        label: messages.getMessage('alias', [], 'package_version_list')
      },
      {
        key: 'IsPasswordProtected',
        label: messages.getMessage('installKey', [], 'package_version_list')
      },
      { key: 'IsReleased', label: 'Released' },
      {
        key: 'ValidationSkipped',
        label: messages.getMessage('validationSkipped', [], 'package_version_list')
      },
      { key: 'AncestorId', label: 'Ancestor' },
      { key: 'AncestorVersion', label: 'Ancestor Version' },
      {
        key: 'Branch',
        label: messages.getMessage('packageBranch', [], 'package_version_list')
      }
    ];

    if (this.verbose) {
      columns.push({
        key: 'Package2Id',
        label: messages.getMessage('packageId', [], 'package_version_list')
      });
      columns.push({
        key: 'InstallUrl',
        label: messages.getMessage('installUrl', [], 'package_version_list')
      });
      columns.push({
        key: 'Id',
        label: messages.getMessage('id', [], 'package_version_list')
      });
      columns.push({ key: 'CreatedDate', label: 'Created Date' });
      columns.push({ key: 'LastModifiedDate', label: 'Last Modified Date' });
      columns.push({
        key: 'Tag',
        label: messages.getMessage('packageTag', [], 'package_version_list')
      });
      columns.push({
        key: 'Description',
        label: messages.getMessage('description', [], 'package_version_list')
      });
      columns.push({
        key: 'CodeCoverage',
        label: messages.getMessage('codeCoverage', [], 'package_version_list')
      });
      columns.push({
        key: 'HasPassedCodeCoverageCheck',
        label: messages.getMessage('hasPassedCodeCoverageCheck', [], 'package_version_list')
      });
      columns.push({
        key: 'ConvertedFromVersionId',
        label: messages.getMessage('convertedFromVersionId', [], 'package_version_list')
      });
      columns.push({
        key: 'IsOrgDependent',
        label: messages.getMessage('isOrgDependent', [], 'package_list')
      });
    }

    return columns;
  }
}

export = PackageVersionListCommand;

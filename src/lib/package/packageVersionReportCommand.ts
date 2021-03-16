/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';

// Local
import Messages = require('../messages');
const messages = Messages();
import logger = require('../core/logApi');
import pkgUtils = require('./packageUtils');

// Stripping CodeCoverage, HasPassedCodeCoverageCheck as they are causing a perf issue in 49.0+ W-7495440
const QUERY =
  'SELECT Id, Package2Id, SubscriberPackageVersionId, Name, Description, Tag, Branch, AncestorId, ValidationSkipped, ' +
  'MajorVersion, MinorVersion, PatchVersion, BuildNumber, IsReleased, CodeCoverage, HasPassedCodeCoverageCheck, ConvertedFromVersionId, ' +
  'Package2.IsOrgDependent, ReleaseVersion, BuildDurationInSeconds, HasMetadataRemoved ' +
  'FROM Package2Version ' +
  "WHERE Id = '%s' AND IsDeprecated != true " +
  'ORDER BY Package2Id, Branch, MajorVersion, MinorVersion, PatchVersion, BuildNumber';

class PackageVersionReportCommand {
  static QUERY = QUERY;

  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('package:version:report');
  }

  execute(context) {
    return this._execute(context).catch(err => {
      // TODO
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      throw pkgUtils.applyErrorAction(err);
    });
  }

  async _execute(context) {
    this.org = context.org;
    this.force = context.org.force;
    this.verbose = context.flags.verbose;

    let packageVersionId = pkgUtils.getPackageIdFromAlias(context.flags.package, this.force);

    // ID can be an 04t or 05i
    pkgUtils.validateId(
      [pkgUtils.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, pkgUtils.BY_LABEL.PACKAGE_VERSION_ID],
      packageVersionId
    );

    // lookup the 05i ID, if needed
    packageVersionId = await pkgUtils.getPackageVersionId(packageVersionId, this.force, this.org);

    return this.force.toolingQuery(this.org, util.format(QUERY, packageVersionId)).then(async queryResult => {
      const results = [];
      const records = queryResult.records;
      if (records && records.length > 0) {
        const record = records[0];
        record.Version = [record.MajorVersion, record.MinorVersion, record.PatchVersion, record.BuildNumber].join('.');

        let ancestorVersion = null;
        const containerOptions = await pkgUtils.getContainerOptions([record.Package2Id], this.force, this.org);
        let packageType = containerOptions.get(record.Package2Id);
        if (record.AncestorId) {
          // lookup AncestorVersion value
          const ancestorVersionMap = await pkgUtils.getPackageVersionStrings([record.AncestorId], this.force, this.org);
          ancestorVersion = ancestorVersionMap.get(record.AncestorId);
        } else {
          // otherwise display 'N/A' if package is Unlocked Packages
          if (packageType !== 'Managed') {
            ancestorVersion = 'N/A';
            record.AncestorId = 'N/A';
          }
        }

        record.CodeCoverage =
          record.Package2.IsOrgDependent === true || record.ValidationSkipped === true ? 'N/A' : record.CodeCoverage;

        record.HasPassedCodeCoverageCheck =
          record.Package2.IsOrgDependent === true || record.ValidationSkipped === true
            ? 'N/A'
            : record.HasPassedCodeCoverageCheck;

        record.Package2.IsOrgDependent =
          packageType === 'Managed' ? 'N/A' : record.Package2.IsOrgDependent === true ? 'Yes' : 'No';

        // set HasMetadataRemoved to N/A for Unlocked, and No when value is false or absent (pre-230)
        record.HasMetadataRemoved =
          packageType !== 'Managed' ? 'N/A' : record.HasMetadataRemoved === true ? 'Yes' : 'No';

        if (context.flags.json) {
          // add AncestorVersion to the json record
          record.AncestorVersion = ancestorVersion;
        }

        const retRecord = context.flags.json
          ? record
          : [
              {
                key: messages.getMessage('name', [], 'package_version_list'),
                value: record.Name
              },
              {
                key: messages.getMessage('subscriberPackageVersionId', [], 'package_version_list'),
                value: record.SubscriberPackageVersionId
              },
              { key: 'Id', value: record.Id },
              {
                key: messages.getMessage('packageId', [], 'package_version_list'),
                value: record.Package2Id
              },
              {
                key: messages.getMessage('version', [], 'package_version_list'),
                value: record.Version
              },
              {
                key: messages.getMessage('description', [], 'package_version_list'),
                value: record.Description
              },
              {
                key: messages.getMessage('packageBranch', [], 'package_version_list'),
                value: record.Branch
              },
              {
                key: messages.getMessage('packageTag', [], 'package_version_list'),
                value: record.Tag
              },
              { key: 'Released', value: record.IsReleased.toString() },
              {
                key: messages.getMessage('validationSkipped', [], 'package_version_list'),
                value: record.ValidationSkipped
              },
              { key: 'Ancestor', value: record.AncestorId },
              { key: 'Ancestor Version', value: ancestorVersion },
              {
                key: messages.getMessage('codeCoverage', [], 'package_version_list'),
                value:
                  record.CodeCoverage == null
                    ? ' '
                    : record.CodeCoverage['apexCodeCoveragePercentage']
                    ? `${record.CodeCoverage['apexCodeCoveragePercentage']}%`
                    : record.CodeCoverage // N/A
              },
              {
                key: messages.getMessage('hasPassedCodeCoverageCheck', [], 'package_version_list'),
                value: record.HasPassedCodeCoverageCheck
              },
              {
                key: messages.getMessage('convertedFromVersionId', [], 'package_version_list'),
                value: record.ConvertedFromVersionId == null ? ' ' : record.ConvertedFromVersionId
              },
              {
                key: messages.getMessage('isOrgDependent', [], 'package_list'),
                value: record.Package2.IsOrgDependent
              },
              {
                key: messages.getMessage('releaseVersion', [], 'package_version_list'),
                value: record.ReleaseVersion == null ? '' : Number.parseFloat(record.ReleaseVersion).toFixed(1)
              },
              {
                key: messages.getMessage('buildDurationInSeconds', [], 'package_version_list'),
                value: record.BuildDurationInSeconds == null ? '' : record.BuildDurationInSeconds
              },
              {
                key: messages.getMessage('hasMetadataRemoved', [], 'package_version_list'),
                value: record.HasMetadataRemoved
              }
            ];
        if (!this.verbose) {
          // only expose Id in verbose output
          if (context.flags.json) {
            delete retRecord.Id;
            delete retRecord.ConvertedFromVersionId;
          } else {
            retRecord.splice(retRecord.map(e => e.key).indexOf('Id'), 1);
            retRecord.splice(
              retRecord
                .map(e => e.key)
                .indexOf(messages.getMessage('convertedFromVersionId', [], 'package_version_list')),
              1
            );
          }
        }
        return retRecord;
      }

      return results;
    });
  }

  /**
   * indicates that the human readable message should be tabular
   * @returns {[{}...]}
   */
  getColumnData() {
    this.logger.styledHeader(this.logger.color.blue('Package Version'));
    return [
      { key: 'key', label: 'Name' },
      { key: 'value', label: 'Value' }
    ];
  }
}

export = PackageVersionReportCommand;

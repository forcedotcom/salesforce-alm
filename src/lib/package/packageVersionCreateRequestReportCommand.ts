/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import Messages = require('../messages');
const messages = Messages();
import logger = require('../core/logApi');
import pkgUtils = require('./packageUtils');
import PackageVersionCreateRequestApi = require('./packageVersionCreateRequestApi');

const ERROR_LIMIT = 12;

class PackageVersionCreateRequestReportCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('package:version:create:report');
  }

  execute(context) {
    return this._execute(context).catch(err => {
      // TODO
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      throw pkgUtils.applyErrorAction(err);
    });
  }

  _execute(context) {
    pkgUtils.validateId(pkgUtils.BY_LABEL.PACKAGE_VERSION_CREATE_REQUEST_ID, context.flags.packagecreaterequestid);

    this.packageVersionCreateRequestApi = new PackageVersionCreateRequestApi(context.org.force, context.org);
    return this.packageVersionCreateRequestApi.byId(context.flags.packagecreaterequestid).then(records => {
      if (context.flags.json) {
        return records;
      } else if (records && records.length > 0) {
        const record = records[0];

        const installUrlValue =
          record.Status === 'Success' ? pkgUtils.INSTALL_URL_BASE + record.SubscriberPackageVersionId : '';

        const data = [
          {
            key: messages.getMessage('id', [], 'package_version_create_list'),
            value: record.Id
          },
          {
            key: messages.getMessage('status', [], 'package_version_create_list'),
            value: pkgUtils.convertCamelCaseStringToSentence(record.Status)
          },
          {
            key: messages.getMessage('packageId', [], 'package_version_create_list'),
            value: record.Package2Id
          },
          {
            key: messages.getMessage('packageVersionId', [], 'package_version_create_list'),
            value: record.Package2VersionId
          },
          {
            key: messages.getMessage('subscriberPackageVersionId', [], 'package_version_create_list'),
            value: record.SubscriberPackageVersionId
          },
          {
            key: messages.getMessage('tag', [], 'package_version_create_list'),
            value: record.Tag
          },
          {
            key: messages.getMessage('branch', [], 'package_version_create_list'),
            value: record.Branch
          },
          { key: 'Created Date', value: record.CreatedDate },
          {
            key: messages.getMessage('installUrl', [], 'package_version_create_list'),
            value: installUrlValue
          }
        ];

        this.logger.styledHeader(this.logger.color.blue('Package Version Create Request'));
        this.logger.table(data, {
          columns: [
            { key: 'key', label: 'Name' },
            { key: 'value', label: 'Value' }
          ]
        });

        if (record.Error && record.Error.length > 0) {
          const errors = [];
          record.Error.slice(0, ERROR_LIMIT).forEach(error => {
            errors.push(`(${errors.length + 1}) ${error}`);
          });
          this.logger.styledHeader(this.logger.color.red('Errors'));
          this.logger.log(errors.join('\n'));

          // Check if errors were truncated.  If so, inform the user with
          // instructions on how to retrieve the remaining errors.
          if (record.Error.length > ERROR_LIMIT) {
            this.logger.log(
              messages.getMessage(
                'truncatedErrors',
                context.flags.packagecreaterequestid,
                'package_version_create_report'
              )
            );
          }
        }
      }

      return null;
    });
  }
}

export = PackageVersionCreateRequestReportCommand;

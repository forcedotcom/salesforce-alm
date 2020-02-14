/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
import * as _ from 'lodash';
const { sleep } = require('@salesforce/kit');

// Local
import logApi = require('../core/logApi');
import Messages = require('../messages');
const messages = Messages();
import pkgUtils = require('../package/packageUtils');

let logger;
const DEFAULT_POLL_INTERVAL_IN_MILLISECONDS = 5000;
const DEFAULT_MAX_RETRIES = 0;
const RETRY_MINUTES_IN_MILLIS = 60000;
const ERROR_QUERY =
  "SELECT Message FROM PackageVersionUninstallRequestError WHERE ParentRequest.Id = '%s' ORDER BY Message";

/**
 * This uninstalls a package in to a target org.
 * @param context: heroku context
 * @returns {*|promise}
 */
class PackageUninstallCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor(pollIntervalInMillis?) {
    this.pollIntervalInMillis = _.isNil(pollIntervalInMillis)
      ? DEFAULT_POLL_INTERVAL_IN_MILLISECONDS
      : pollIntervalInMillis;
    this.maxRetries = DEFAULT_MAX_RETRIES;
    this.id = null;
    logger = logApi.child('force:package:uninstall');
  }

  poll(context, id, retries) {
    this.org = context.org;
    this.force = this.org.force;

    const username = context.flags.targetusername;
    const orgApi = context.org;
    if (username) {
      orgApi.setName(username);
    }
    return orgApi.force.toolingRetrieve(orgApi, 'SubscriberPackageVersionUninstallRequest', id).then(request => {
      switch (request.Status) {
        case 'Success': {
          return request;
        }
        case 'Error': {
          const err = messages.getMessage('defaultErrorMessage', [this.id, request.Id], 'package_uninstall');
          return this.force.toolingQuery(this.org, util.format(ERROR_QUERY, id)).then(queryResult => {
            const errors = [];
            if (queryResult.records && queryResult.records.length > 0) {
              queryResult.records.forEach(record => {
                errors.push(`(${errors.length + 1}) ${record.Message}`);
              });
            }

            const error = new Error(`${err}${errors.length > 0 ? `\n=== Errors\n${errors.join('\n')}` : ''}`);
            error['name'] = 'UNINSTALL_ERROR';
            error['action'] = messages.getMessage('action', [], 'package_uninstall');
            throw error;
          });
        }
        default: {
          if (retries > 0) {
            // Request still in progress.  Just print a console message and move on. Server will be polled again.
            if (this.status !== request.Status) {
              this.status = request.Status;
              logger.log(`Waiting for the package uninstall request to get processed. Status = ${request.Status}`);
            }

            return sleep(this.pollIntervalInMillis).then(this.poll.bind(this, context, id, retries - 1));
          }
          return request;
        }
      }
    });
  }

  execute(context) {
    return this._execute(context).catch(err => {
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      throw pkgUtils.applyErrorAction(err);
    });
  }

  _execute(context) {
    this.org = context.org;
    this.force = context.org.force;
    const username = context.flags.targetusername;

    // either of the id or package flag is required, not both at the same time
    if ((!context.flags.id && !context.flags.package) || (context.flags.id && context.flags.package)) {
      const idFlag = context.command.flags.find(x => x.name === 'id');
      const packageFlag = context.command.flags.find(x => x.name === 'package');
      throw new Error(
        messages.getMessage(
          'errorRequiredFlags',
          [`--${idFlag.name} (-${idFlag.char})`, `--${packageFlag.name} (-${packageFlag.char})`],
          'package_uninstall'
        )
      );
    }

    let apvId;
    if (context.flags.id) {
      apvId = context.flags.id;
    } else if (context.flags.package) {
      // look up the alias only when it's not a 04t
      apvId = context.flags.package.startsWith(pkgUtils.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID.prefix)
        ? context.flags.package
        : pkgUtils.getPackageIdFromAlias(context.flags.package, this.force);
    }

    // validate whatever is set as the apvId, even if that might be a bunk alias
    try {
      pkgUtils.validateId(pkgUtils.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, apvId);
    } catch (err) {
      throw new Error(messages.getMessage('invalidIdOrPackage', apvId, 'package_uninstall'));
    }

    this.id = apvId;
    this.maxRetries = _.isNil(context.flags.wait)
      ? this.maxRetries
      : (RETRY_MINUTES_IN_MILLIS / this.pollIntervalInMillis) * context.flags.wait;

    const apiVersion = this.org.config.getApiVersion();
    if (apiVersion < 36) {
      throw new Error('This command is supported only on API versions 36.0 and higher');
    }

    // Construct SubscriberPackageVersionUnininstallRequest sobject used to trigger package uninstall.
    const packageUninstallRequest = {
      SubscriberPackageVersionId: this.id
    };

    // TODO: should be able to remove org.setName since framework handles org setup via cmdDef.supportsTargetUsername (true or undefined)
    if (username) {
      this.org.setName(username);
    }
    return this.force
      .toolingCreate(this.org, 'SubscriberPackageVersionUninstallRequest', packageUninstallRequest)
      .then(result => {
        if (result.success) {
          return this.poll.bind(this)(context, result.id, this.maxRetries);
        } else {
          throw new Error(result.errors);
        }
      });
  }

  /**
   * returns a human readable message for a cli output
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    const arg = result.Status === 'Success' ? [result.SubscriberPackageVersionId] : [result.Id, this.org.name];
    return messages.getMessage(result.Status, arg, 'package_uninstall_report');
  }
}
export = PackageUninstallCommand;

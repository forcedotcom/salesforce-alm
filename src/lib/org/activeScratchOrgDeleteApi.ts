/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import Org = require('../core/scratchOrgApi');
import HubOrgApi = require('../core/hubOrgApi');
import messagesApi = require('../messages');
import * as almError from '../core/almError';
import logger = require('../core/logApi');
import srcDevUtil = require('../core/srcDevUtil');

/**
 * Delete the ActiveScratchOrg record.  This enqueues the scratch org for delete.
 */
const _shouldDeleteActiveScratchOrg = function (result, hubOrg, messages, data) {
  if (result.records.length !== 1) {
    const err = new Error(messages.getMessage('deleteOrgCommandQueryError', [data.orgId, result.records.length]));
    err['name'] = 'DeleteOrgCommandQueryError';
    return Promise.reject(err);
  }
  const activeScratchOrgId = result.records[0].Id;
  return hubOrg.force.delete(hubOrg, 'ActiveScratchOrg', activeScratchOrgId);
};

/**
 * Query for the ActiveScratchOrg associated with the scratch org.
 */
const _queryForActiveScratchOrg = function (data, hubOrg) {
  // Use the 15 char org ID for the query
  data.orgId15 = srcDevUtil.trimTo15(data.orgId);
  return hubOrg.force.query(hubOrg, `SELECT Id FROM ActiveScratchOrg WHERE ScratchOrg='${data.orgId15}'`);
};

class OrgDeleteApi {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  /**
   * Delete Org API object
   *
   * @constructor
   */
  constructor() {
    this.hubOrg = new HubOrgApi();
    this.messages = messagesApi();
    this.logger = logger.child('OrgDeleteApi');
  }

  /**
   * Perform the delete of a scratch org.
   *
   * @scratchOrg {object} The scratchOrg to delete
   */
  doDelete(scratchOrg, devHubUsername) {
    return scratchOrg.getConfig().then((scratchData) => {
      if (scratchData.devHubUsername) {
        this.hubOrg.setName(scratchData.devHubUsername);
      }

      // resolve the hub org of the user performing the delete (either default hub user or the override).
      const hubOrgPromise = devHubUsername
        ? Org.create(devHubUsername)
        : this.hubOrg.getConfig().then((c) => Org.create(c.username));

      return hubOrgPromise.then((deletingUserOrg) => {
        if (scratchData.orgId !== deletingUserOrg.authConfig.orgId) {
          return _queryForActiveScratchOrg(scratchData, deletingUserOrg)
            .then((result) => _shouldDeleteActiveScratchOrg(result, deletingUserOrg, this.messages, scratchData))
            .catch((err) => {
              this.logger.info(err.message);
              if (err.name === 'INVALID_TYPE' || err.name === 'INSUFFICIENT_ACCESS_OR_READONLY') {
                this.logger.info('Insufficient privilege to access ActiveScratchOrgs.');
                throw almError('insufficientAccessToDelete');
              }
              this.logger.info('The above error can be the result of deleting an expired or already deleted org.');
              this.logger.info('attempting to cleanup the auth file');
              throw almError('attemptingToDeleteExpiredOrDeleted');
            });
        } else {
          return Promise.reject(almError('deleteOrgHubError'));
        }
      });
    });
  }
}

export = OrgDeleteApi;

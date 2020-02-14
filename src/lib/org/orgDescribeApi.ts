/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';
import * as BBPromise from 'bluebird';
import logger = require('../core/logApi');
import messages = require('../messages');
import Org = require('../core/scratchOrgApi');
import Alias = require('../core/alias');
import { Dictionary } from '@salesforce/ts-types';

class OrgDescribeApi {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.messages = messages();
    this.logger = logger.child('orgDescribeApi');
  }

  /**
   * Get the connection details for a specified org or the default workspace org.
   *
   * @param org - the org to describe
   * @returns {BBPromise}  a promise resolved with the org connection details
   */
  describeOrg(org) {
    if (_.isNil(org)) {
      const error = new Error('org is null or undefined.');
      error['name'] = 'OrgIsNotDefined';
      return BBPromise.reject(error);
    }

    const orgDesc: Dictionary<any> = {};
    let isDevHub = false;

    return (
      org
        .refreshAuth()
        .then(() => org.getConfig())
        .then(orgConfig => {
          if (orgConfig.password) {
            orgDesc.password = orgConfig.password;
          }

          orgDesc.username = org.getName();
          // TODO: Get the org id for the username
          orgDesc.devHubId = orgConfig.devHubUsername;
          isDevHub = orgConfig.isDevHub;

          if (orgConfig && orgConfig.orgId) {
            orgDesc.id = orgConfig.orgId;
          }

          return BBPromise.resolve({});
        })
        .then(() => {
          let usernamePromise;

          // if the org describe is against a dev hub.
          if (isDevHub) {
            usernamePromise = BBPromise.resolve([`${org.username}.json`]);
          }
          // if the org describe is against an org with an associated dev hub.
          else if (orgDesc.devHubId) {
            usernamePromise = BBPromise.resolve([`${orgDesc.devHubId}.json`, `${orgDesc.username}.json`]);
          }
          // this org isn't known to be related to a devHub but it still could be. We can build
          // a metadata data structure of scratch orgs to dev hubs.
          else {
            usernamePromise = Org.readAllUserFilenames();
          }

          return usernamePromise;
        })
        // exclude properties must be null for org:display. By default readLocallyValidatedMetaConfigsGroupedByOrgType will filter out refresh tokens and
        // client secrets. The org:display command depends on the refresh token and client secret when displaying auth urls.
        .then(usernames => Org.readLocallyValidatedMetaConfigsGroupedByOrgType(usernames, undefined, null))
        .then(metaConfigsGroupedByOrgType => {
          let orgInfo;
          if (metaConfigsGroupedByOrgType) {
            orgInfo =
              metaConfigsGroupedByOrgType.nonScratchOrgs.get(org.getName()) ||
              metaConfigsGroupedByOrgType.scratchOrgs.get(org.getName());

            Org.computeAndUpdateStatusForMetaConfig(orgInfo, metaConfigsGroupedByOrgType.devHubs);

            if (orgInfo) {
              if (orgInfo.createdBy) {
                orgDesc.createdBy = orgInfo.createdBy;
              }

              if (orgInfo.createdDate) {
                orgDesc.createdDate = orgInfo.createdDate;
              }

              if (orgInfo.expirationDate) {
                orgDesc.expirationDate = orgInfo.expirationDate;
              }

              if (orgInfo.status) {
                orgDesc.status = orgInfo.status;
              }

              if (orgInfo.edition) {
                orgDesc.edition = orgInfo.edition;
              }

              if (orgInfo.orgName) {
                orgDesc.orgName = orgInfo.orgName;
              }

              if (orgInfo.snapshot) {
                orgDesc.snapshot = orgInfo.snapshot;
              }

              // Only display connected status for nonScratchOrgs.
              if (_.isNil(orgInfo.devHubUsername) && orgInfo.connectedStatus) {
                orgDesc.connectedStatus = orgInfo.connectedStatus;
              }
            }
          }
          return orgInfo;
        })
        .then(() => org.force._getConnection(org, org.config))
        .then(({ accessToken, refreshToken, instanceUrl, oauth2 }) => {
          orgDesc.accessToken = accessToken;
          orgDesc.instanceUrl = instanceUrl;

          const clientId = oauth2.clientId;

          if (clientId) {
            orgDesc.clientId = clientId;

            if (refreshToken) {
              // add-on does not expect protocol
              instanceUrl = instanceUrl.startsWith('http')
                ? instanceUrl.substring(instanceUrl.indexOf('//') + 2)
                : instanceUrl;

              // FIXME: update add-on to not require client secret
              // spoof SFDX connected app secret
              const clientSecret = oauth2.clientSecret || '';

              orgDesc.sfdxAuthUrl = `force://${clientId}:${clientSecret}:${refreshToken}@${instanceUrl}`;
            }
          }
        })
        .then(() => Alias.byValue(orgDesc.username))
        // Update the alias
        .then(alias => {
          if (alias) {
            orgDesc.alias = alias;
          }

          return BBPromise.resolve(orgDesc);
        })
    );
  }
}

export = OrgDescribeApi;

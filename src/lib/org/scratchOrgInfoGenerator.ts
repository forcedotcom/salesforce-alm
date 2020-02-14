/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';

// Local
import * as ConfigApi from '../core/configApi';
import pkg2Utils = require('../package/packageUtils');
import { ScratchOrgFeatureDeprecation } from './scratchOrgFeatureDeprecation';

const defaultConnectedAppInfo = require('../core/defaultConnectedApp');
import Messages = require('../messages');
const messages = Messages();

// constants
const DEFAULT_COMPANY = 'Company';

/**
 * Helper method to read the namespace configured for this workspace.
 * @param configApi
 * @throws Formatting exceptions associated with reading the workspace config.
 * @returns {*} The namespace associated with the workspace.
 * @private
 */
const _getNamespace = function(configApi) {
  const namespace = configApi.getAppConfigIfInWorkspace().namespace;

  if (_.isNil(namespace)) {
    // no workspace
    return undefined;
  }

  return namespace;
};

/*
 * A helper module for generating scratch org info
 */
const scratchOrgInfoGenerator = {
  /**
   * Generates the package2AncestorIds flag
   * @param scratchOrgInfo - the scratchOrgInfo passed in by the user
   * @param config - the app config
   * @param org
   * @param noAncestorIds - true of the sfdx-project.json ancestorId keys should be ignored
   */
  _getAncestorIds(scratchOrgInfo, config, org?, noAncestorIds?) {
    if (Object.prototype.hasOwnProperty.call(scratchOrgInfo, 'package2AncestorIds')) {
      return Promise.reject(new Error(messages.getMessage('errorpackage2AncestorIdsKeyNotSupported', [], 'package2')));
    } else if (noAncestorIds || !config.packageDirectories) {
      return Promise.resolve().then(() => '');
    } else {
      const getAncestorPromises = [];
      for (const packageDir of config.packageDirectories) {
        const result = Promise.resolve(pkg2Utils.getAncestorId(packageDir, org.force, org));
        getAncestorPromises.push(result);
      }
      return Promise.all(getAncestorPromises).then(ancestorIds => [...new Set(ancestorIds.filter(Boolean))].join(';'));
    }
  },

  /**
   * Takes in a scratchOrgInfo and fills in the missing fields
   * @param masterOrg
   * @param scratchOrgInfo - the scratchOrgInfo passed in by the user
   * @param orgType
   * @param nonamespace - true if the org should have no namepsace
   * @param ignoreAncestorIds - true if the sfdx-project.json ancestorId keys should be ignored
   */
  generateScratchOrgInfo(masterOrg, scratchOrgInfo, orgType, nonamespace?, ignoreAncestorIds?) {
    if (_.isNil(scratchOrgInfo.orgName)) {
      scratchOrgInfo.OrgName = DEFAULT_COMPANY;
    }

    const config = new ConfigApi.Config().getAppConfigIfInWorkspace();

    if (_.isNil(scratchOrgInfo.adminEmail)) {
      scratchOrgInfo.AdminEmail = config.adminEmail;
    }

    if (_.isNil(scratchOrgInfo.country)) {
      scratchOrgInfo.Country = config.country;
    }

    return this._getAncestorIds(scratchOrgInfo, config, masterOrg, ignoreAncestorIds).then(ancestorIds => {
      scratchOrgInfo.package2AncestorIds = ancestorIds;

      // convert various supported array and string formats to a semi-colon-delimited string
      if (scratchOrgInfo.features) {
        if (_.isString(scratchOrgInfo.features)) {
          const delimiter = scratchOrgInfo.features.includes(';') ? ';' : ',';
          scratchOrgInfo.features = scratchOrgInfo.features.split(delimiter);
        }
        scratchOrgInfo.features = scratchOrgInfo.features.map(_.trim);

        const scratchOrgFeatureDeprecation = new ScratchOrgFeatureDeprecation();

        scratchOrgInfo.features = scratchOrgFeatureDeprecation.filterDeprecatedFeatures(scratchOrgInfo.features);

        scratchOrgInfo.features = scratchOrgInfo.features.join(';');
      }

      return masterOrg
        .getConfig()
        .then(hubConfig => {
          // Use the Hub org's client ID value, if one wasn't provided to us
          if (_.isNil(scratchOrgInfo.connectedAppConsumerKey)) {
            scratchOrgInfo.connectedAppConsumerKey = hubConfig.clientId;
          }
          // If the Hub org doesn't have one (most likely an access token), use the default connected app
          if (_.isNil(scratchOrgInfo.connectedAppConsumerKey)) {
            scratchOrgInfo.connectedAppConsumerKey = defaultConnectedAppInfo.clientId;
          }
        })
        .then(() => {
          // Set the namespace of the release org
          const namespace = _getNamespace(masterOrg.force.getConfig());
          if (!nonamespace && !_.isNil(namespace)) {
            scratchOrgInfo.Namespace = namespace;
          }

          scratchOrgInfo.ConnectedAppCallbackUrl = masterOrg.force.getConfig().getOauthCallbackUrl();
          return scratchOrgInfo;
        });
    });
  }
};

export = scratchOrgInfoGenerator;

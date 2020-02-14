/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';
import * as BBPromise from 'bluebird';

import Org = require('../core/scratchOrgApi');
import Messages = require('../messages');
const messages = Messages();
import logger = require('../core/logApi');
import OrgDecorator = require('./orgHighlighter');

const EMPTY_STRING = '';

/**
 * help to decorate the defaultusername and defaultdevhubusername
 * @param {object} val - org metadata
 * @private
 */
const _extractDefaultOrgStatus = function(val) {
  // I'll use the sort function as a decorator so I can eliminate the need to loop.
  if (val.isDefaultDevHubUsername) {
    val.defaultMarker = '(D)';
  } else if (val.isDefaultUsername) {
    val.defaultMarker = '(U)';
  }
};

/**
 * Command impl for force:org:list
 */
class OrgListCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor(stdinPromise) {
    this.stdinPromise = stdinPromise;
    this.logger = logger.child('OrgListCommand');
    this.orgDecorator = new OrgDecorator(this.logger);
  }

  execute(context) {
    const sortAndDecorateFunc = val => {
      const sortVal = val.username;

      _extractDefaultOrgStatus(val);
      this.orgDecorator.decorateStatus(val);
      this.orgDecorator.decorateConnectedStatus(val);

      return [val.alias, sortVal];
    };

    return Org.readAllUserFilenames()
      .then(fileNames => Org.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames))
      .then(metaConfigs => {
        if (context && context.clean) {
          // Reduce the scratchOrg map into a new map less the expired and deleted items.
          // Provided the clean parameter specified.
          const scratchOrgsToDelete = [];
          const newScratchOrgList = [];
          metaConfigs.scratchOrgs.forEach(value => {
            Org.computeAndUpdateStatusForMetaConfig(value, metaConfigs.devHubs);
            if (value.status === 'Deleted' || value.status === 'Expired' || value.status === 'Missing') {
              scratchOrgsToDelete.push(value.username);
            } else {
              newScratchOrgList.push(value);
            }
          });

          if (scratchOrgsToDelete.length > 0) {
            const _promise = context.noprompt
              ? BBPromise.resolve('Y')
              : this.stdinPromise(messages.getMessage('prompt', [scratchOrgsToDelete.length], 'org_list'));

            return _promise.then(answer => {
              if (answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y') {
                // Run all the delete promises
                return BBPromise.map(
                  scratchOrgsToDelete,
                  orgConfigToDelete => {
                    const org = new Org();
                    org.setName(orgConfigToDelete);
                    return org.deleteConfig();
                  },
                  { concurrency: 1 }
                ).then(() => {
                  metaConfigs.scratchOrgs = newScratchOrgList;
                  return BBPromise.resolve(metaConfigs);
                });
              }
              return metaConfigs;
            });
          }
        }
        return metaConfigs;
      })
      .then(metaConfigs => {
        // Using an array to avoid an additional iteration (Array.from) in the next handler.
        const newScratchOrgs = [];
        metaConfigs.scratchOrgs.forEach(value => {
          Org.computeAndUpdateStatusForMetaConfig(value, metaConfigs.devHubs);
          if (context.all || value.status === 'Active') {
            newScratchOrgs.push(value);
          }
        });

        metaConfigs.scratchOrgs = newScratchOrgs;
        return metaConfigs;
      })

      .then(metaConfigs => {
        logger.styledHeader(logger.color.blue('Orgs'));
        return metaConfigs;
      })
      .then(metaConfigs => {
        this.noScratchOrgs = _.isEmpty(metaConfigs.scratchOrgs);
        return {
          nonScratchOrgs: _.sortBy(Array.from(metaConfigs.nonScratchOrgs.values()), sortAndDecorateFunc),
          scratchOrgs: _.sortBy(metaConfigs.scratchOrgs, sortAndDecorateFunc)
        };
      });
  }

  validate(context) {
    if (context.flags.verbose) {
      this.verbose = true;
    }
    if (context.flags.all) {
      this.all = true;
    }

    return BBPromise.resolve(context.flags);
  }

  getHumanErrorMessage() {
    return EMPTY_STRING;
  }

  getHumanSuccessMessage() {
    return EMPTY_STRING;
  }

  getEmptyResultMessage(key) {
    if (key === 'scratchOrgs') {
      return messages.getMessage('noActiveScratchOrgs', null, 'org_list');
    } else {
      return null;
    }
  }

  getColumnData() {
    // default columns for the non scratch org list
    const nonScratchOrgColumns = [
      { key: 'defaultMarker', label: '' },
      { key: 'alias', label: 'ALIAS' },
      { key: 'username', label: 'USERNAME' },
      { key: 'orgId', label: 'ORG ID' },
      { key: 'connectedStatus', label: 'CONNECTED STATUS' }
    ];

    // default columns for the scratch org list
    const scratchOrgColumns = [
      { key: 'defaultMarker', label: '' },
      { key: 'alias', label: 'ALIAS' },
      { key: 'orgName', label: 'SCRATCH ORG NAME' },
      // This value is duplicated in the object as signupUsername.
      { key: 'username', label: 'USERNAME' },
      { key: 'orgId', label: 'ORG ID' }
    ];

    if (this.all || this.verbose) {
      scratchOrgColumns[5] = { key: 'status', label: 'STATUS' };
    }

    // scratch org verbose columns
    if (this.verbose) {
      scratchOrgColumns[6] = { key: 'devHubOrgId', label: 'DEV HUB' };
      scratchOrgColumns[7] = { key: 'createdDate', label: 'CREATED DATE' };
      scratchOrgColumns[8] = { key: 'instanceUrl', label: 'INSTANCE URL' };
    }

    // scratch org expiration date should be on the end.
    scratchOrgColumns.push({ key: 'expirationDate', label: 'EXPIRATION DATE' });

    return {
      nonScratchOrgs: nonScratchOrgColumns,
      scratchOrgs: scratchOrgColumns
    };
  }
}
export = OrgListCommand;

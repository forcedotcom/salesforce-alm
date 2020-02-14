/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as BBPromise from 'bluebird';

import srcDevUtil = require('../core/srcDevUtil');
import Messages = require('../messages');
const messages = Messages();
import Org = require('../core/scratchOrgApi');
import { ConfigAggregator } from '@salesforce/core';

const _logout = function(orgApi, orgsToLogout) {
  return ConfigAggregator.create().then(aggregator => {
    if (orgsToLogout && Array.from(orgsToLogout.keys()).length > 0) {
      // Run all the delete promises
      return BBPromise.map(
        Array.from(orgsToLogout.keys()),
        orgConfigToDelete => {
          const org = new Org();
          org.setName(orgConfigToDelete);

          // By default, the orgType is defaultusername. If we are logging out of the default dev hub
          // we need to update org.type so that config variable gets unset appropriately
          const configInfo = aggregator.getConfigInfo().find(param => param.value === org.name);
          if (configInfo) {
            org.type = configInfo.key;
          }
          return org.deleteConfig();
        },
        { concurrency: 1 }
      );
    } else {
      return orgApi.deleteConfig();
    }
  });
};

class AuthLogoutCommand {
  private org;
  private orgsToLogout;

  /**
   * executes the logout command
   * @param context - the cli context
   * @returns {BBPromise} - a list of the user(s) logged out
   */
  execute() {
    return _logout(this.org, this.orgsToLogout).then(() => Array.from(this.orgsToLogout.keys()));
  }

  validate(context) {
    this.org = context.org;
    this.orgsToLogout = context.orgsToLogout;
    const fixedContext = srcDevUtil.fixCliContext(context);
    return BBPromise.resolve(fixedContext);
  }

  getHumanSuccessMessage() {
    return messages.getMessage('logoutOrgCommandSuccess');
  }

  getOrgsToLogout(context, logger?) {
    if (context.flags.all || (!context.flags.targetusername && logger.getEnvironmentMode().isDemo())) {
      return Org.readAllUserFilenames()
        .then(fileNames => Org.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames))
        .then(metaConfigs => {
          return new Map(
            (function*() {
              yield* metaConfigs.scratchOrgs;
              yield* metaConfigs.devHubs;
              yield* metaConfigs.nonScratchOrgs;
            })()
          );
        });
    } else {
      return new BBPromise(resolve => {
        let org = new Map();
        if (!context.org) {
          let message = messages.getMessage('defaultOrgNotFound', 'defaultusername');
          const noOrgFoundErr: any = Error(message);
          noOrgFoundErr.name = 'NoOrgFound';
          noOrgFoundErr.action = messages.getMessage('defaultOrgNotFoundAction');
          throw noOrgFoundErr;
        }
        resolve(org.set(context.org.name, context.org.authConfig));
      });
    }
  }

  getStyledList(orgsToLogout) {
    const toPrint = [];
    orgsToLogout.forEach(org => {
      // Scratch orgs are the only ones that have a created field
      const isScratchOrg = org.created ? '     (Scratch Org)' : '';
      toPrint.push(`${os.EOL}     ${org.username}${isScratchOrg}`);
    });
    return toPrint;
  }
}

export = AuthLogoutCommand;

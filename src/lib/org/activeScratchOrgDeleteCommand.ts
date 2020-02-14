/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import srcDevUtil = require('../core/srcDevUtil');
import ActiveScratchOrgDeleteApi = require('./activeScratchOrgDeleteApi');

import Messages = require('../messages');
const messages = Messages();

class OrgDeleteCommand {
  // TODO: proper property typing
  [property: string]: any;

  async execute(context) {
    const activeScratchOrgDeleteApi = new ActiveScratchOrgDeleteApi();
    const orgData = await this.org.getConfig();

    try {
      await activeScratchOrgDeleteApi.doDelete(this.org, context.targetdevhubusername);
    } catch (err) {
      if (err.name === 'attemptingToDeleteExpiredOrDeleted') {
        this.alreadyDeleted = true;
      } else {
        // Includes the "insufficientAccessToDelete" error.
        throw err;
      }
    }
    await this.org.deleteConfig();
    return {
      orgId: orgData.orgId,
      username: orgData.userName
    };
  }

  async validate(context) {
    this.org = context.org;
    const fixedContext = srcDevUtil.fixCliContext(context);
    this.username = fixedContext.targetusername;
    if (!this.username) {
      this.username = context.org.name;
    }
    return fixedContext;
  }

  getHumanSuccessMessage() {
    if (this.alreadyDeleted) {
      return messages.getMessage('deleteOrgConfigOnlyCommandSuccess', this.username);
    } else {
      return messages.getMessage('deleteOrgCommandSuccess', this.username);
    }
  }
}

export = OrgDeleteCommand;

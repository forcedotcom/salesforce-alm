/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import srcDevUtil = require('../core/srcDevUtil');
import Messages = require('../messages');
import ActiveScratchOrgDeleteApi = require('./activeScratchOrgDeleteApi');

const messages = Messages();

class OrgDeleteCommand {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
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
      username: orgData.userName,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
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

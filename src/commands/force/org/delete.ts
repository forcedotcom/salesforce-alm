/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import { ToolbeltCommand } from '../../../ToolbeltCommand';
import { Org, Messages } from '@salesforce/core';
import { SandboxOrg } from '../../../lib/org/sandbox/sandboxOrg';
import { SandboxOrgConfig } from '@salesforce/core/lib/config/sandboxOrgConfig';
import { ensureString } from '@salesforce/ts-types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('salesforce-alm', 'org_delete');

export class OrgDeleteCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('commandDescription');
  public static readonly longDescription = messages.getMessage('commandDescriptionLong');
  public static readonly help = messages.getMessage('commandHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly supportsDevhubUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('forceFlagDescription'),
      longDescription: messages.getMessage('forceFlagDescriptionLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const heroku = require('heroku-cli-util');
    let deleteMsgKey;
    const prodOrgUsername = await this.org.getSandboxOrgConfigField(SandboxOrgConfig.Fields.PROD_ORG_USERNAME);
    if (prodOrgUsername) {
      deleteMsgKey = messages.getMessage('sandbox');
    } else {
      deleteMsgKey = messages.getMessage('scratchOrg');
    }
    // don't prompt yes/no if we're forcing the delete request, just execute
    if (this.flags.noprompt) {
      return this.deleteOrg(prodOrgUsername);
    } else {
      return heroku
        .prompt(messages.getMessage('confirmDeleteYesNo', [deleteMsgKey, this.org.getUsername()]), {})
        .then(answer => {
          if (answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y') {
            return this.deleteOrg(prodOrgUsername);
          }
          return undefined;
        });
    }
  }

  private async deleteOrg(prodOrgUsername) {
    if (prodOrgUsername) {
      return this.deleteSandbox(prodOrgUsername);
    } else {
      return this.deleteScratchOrg();
    }
  }

  private async deleteSandbox(prodOrgUsername) {
    let successMessageKey = 'commandSandboxSuccess';
    this.logger.debug('Delete started for sandbox org %s ', this.org.getUsername());
    let prodOrg = await Org.create({
      aliasOrUsername: ensureString(prodOrgUsername),
      aggregator: this.configAggregator
    });
    const prodSandboxOrg = await SandboxOrg.getInstance(prodOrg, this.flags.wait, this.logger, this.flags.clientid);
    try {
      await prodSandboxOrg.deleteSandbox(this.org.getOrgId());
      this.logger.debug('Sandbox org %s successfully marked for deletion', this.org.getUsername());
    } catch (err) {
      if (err.name === 'sandboxProcessNotFoundByOrgId') {
        successMessageKey = 'commandSandboxConfigOnlySuccess';
      } else {
        throw err;
      }
    }
    await this.org.remove();
    this.logger.debug('Sandbox org config %s has been successfully deleted', this.org.getUsername());
    this.ux.log(messages.getMessage(successMessageKey, [this.org.getUsername()]));
  }

  private async deleteScratchOrg() {
    const context = await this.resolveLegacyContext();
    const ActiveScratchOrgDeleteCommand = require('../../../lib/org/activeScratchOrgDeleteCommand');
    const activeScratchOrgDeleteCommand = new ActiveScratchOrgDeleteCommand();
    return await this.execLegacyCommand(activeScratchOrgDeleteCommand, context);
  }
}

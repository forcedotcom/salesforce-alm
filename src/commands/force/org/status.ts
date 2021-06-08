/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Config, Messages } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { SandboxOrg } from '../../../lib/org/sandbox/sandboxOrg';
import { SandboxProgressReporter } from '../../../lib/org/sandbox/sandboxProgressReporter';
import consts = require('../../../lib/core/constants');
import { SandboxEventNames } from '../../../lib/org/sandbox/sandboxConstants';
import Alias = require('../../../lib/core/alias');

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('salesforce-alm', 'org_status');

export class OrgStatusCommand extends SfdxCommand {
  public static readonly longDescription = messages.getMessage('commandLongDescription');
  public static readonly help = messages.getMessage('commandHelp');
  /*
   * TODO: When SfdxCommand change the messages for description to include both the description and the help messages
   *       we have to remove the help from description.
   */
  public static readonly description = messages.getMessage('commandDescription') + '\n\n' + OrgStatusCommand.help;
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;

  public static readonly flagsConfig: FlagsConfig = {
    sandboxname: flags.string({
      char: 'n',
      description: messages.getMessage('sandboxnameFlagDescription'),
      longDescription: messages.getMessage('sandboxnameFlagLongDescription'),
      required: true,
    }),
    setdefaultusername: flags.boolean({
      char: 's',
      description: messages.getMessage('setdefaultusernameFlagDescription'),
      longDescription: messages.getMessage('setdefaultusernameFlagLongDescription'),
      required: false,
    }),
    setalias: flags.string({
      char: 'a',
      description: messages.getMessage('setaliasFlagDescription'),
      longDescription: messages.getMessage('setaliasFlagLongDescription'),
      required: false,
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('waitFlagDescription'),
      longDescription: messages.getMessage('waitFlagLongDescription'),
      required: false,
      min: Duration.minutes(consts.MIN_STREAM_TIMEOUT_MINUTES),
      default: Duration.minutes(consts.DEFAULT_STREAM_TIMEOUT_MINUTES),
    }),
  };

  public async run(): Promise<unknown> {
    this.logger.debug('Status started with args %s ', this.flags);

    const masterProdOrg = this.org;
    const sandboxOrg = SandboxOrg.getInstance(masterProdOrg, this.flags.wait, this.logger, this.flags.clientid);

    // Keep all console output in the command
    sandboxOrg.on(SandboxEventNames.EVENT_STATUS, (results) => {
      SandboxProgressReporter.logSandboxProgress(
        this.ux,
        results.sandboxProcessObj,
        results.interval,
        results.retries,
        results.waitingOnAuth
      );
    });

    sandboxOrg.on(SandboxEventNames.EVENT_RESULT, (results) => {
      SandboxProgressReporter.logSandboxProcessResult(this.ux, results.sandboxProcessObj, results.sandboxRes);
      if (results.sandboxRes && results.sandboxRes.authUserName) {
        if (this.flags.setalias) {
          Alias.set(this.flags.setalias, results.sandboxRes.authUserName).then((result) =>
            this.logger.debug('Set Alias: %s result: %s', this.flags.setalias, result)
          );
        }
        if (this.flags.setdefaultusername) {
          const globalConfig: Config = this.configAggregator.getGlobalConfig();
          globalConfig.set(Config.DEFAULT_USERNAME, results.sandboxRes.authUserName);
          globalConfig
            .write()
            .then((result) =>
              this.logger.debug('Set defaultUsername: %s result: %s', this.flags.setdefaultusername, result)
            );
        }
      }
    });

    this.logger.debug('Calling auth for SandboxName args: %s ', this.flags.sandboxname);
    const results = await sandboxOrg.authWithRetriesByName(this.flags.sandboxname);
    this.logger.debug('Results for auth call: %s ', results);
    if (!results) {
      this.ux.styledHeader('Sandbox Org Creation Status');
      this.ux.log('No SandboxProcess Result Found');
    }
    return results;
  }
}

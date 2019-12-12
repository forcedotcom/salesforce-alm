/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

Messages.importMessagesDirectory(__dirname);
const messages: Messages = Messages.loadMessages('salesforce-alm', 'mdapi_deploy');

import consts = require('../../../../lib/core/constants');
import Stash = require('../../../../lib/core/stash');

export class MdapiDeployReportCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('mdDeployReportCommandCliDescription');
  public static readonly longDescription = messages.getMessage('mdDeployReportCommandCliLong');
  public static readonly help = messages.getMessage('mdDeployReportCommandCliHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('mdapiCliWait', [consts.DEFAULT_MDAPI_WAIT_MINUTES]),
      longDescription: messages.getMessage('mdapiCliWaitLong', [consts.DEFAULT_MDAPI_WAIT_MINUTES]),
      required: false
    }),
    jobid: flags.id({
      char: 'i',
      description: messages.getMessage('mdDeployCommandCliJobId'),
      longDescription: messages.getMessage('mdDeployCommandCliJobIdLong'),
      required: false
    }),
    verbose: flags.builtin({
      description: messages.getMessage('mdDeployCommandCliVerbose'),
      longDescription: messages.getMessage('mdDeployReportCommandCliVerboseLong')
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const MdapiDeployReportCommand = require('../../../../lib/mdapi/mdapiDeployReportCommand');
    return this.execLegacyCommand(new MdapiDeployReportCommand(context), context);
  }
  public resolveUsername(context) {
    return context.flags.jobid ? undefined : Stash.get('targetusername', Stash.Commands.MDAPI_DEPLOY);
  }
}

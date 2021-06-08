/*
 * Copyright (c) 2020, salesforce.com, inc.
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
const messages: Messages = Messages.loadMessages('salesforce-alm', 'mdapi_retrieve');
import consts = require('../../../../lib/core/constants');
import Stash = require('../../../../lib/core/stash');

export class MdapiRetrieveReportCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('reportCommandDescription');
  public static readonly longDescription = messages.getMessage('reportCommandLongDescription');
  public static readonly help = messages.getMessage('reportCommandHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('waitFlagDescription', [consts.DEFAULT_MDAPI_RETRIEVE_WAIT_MINUTES]),
      longDescription: messages.getMessage('waitFlagLongDescription', [consts.DEFAULT_MDAPI_RETRIEVE_WAIT_MINUTES]),
      required: false,
    }),
    retrievetargetdir: flags.directory({
      char: 'r',
      description: messages.getMessage('retrievetargetdirFlagDescription'),
      longDescription: messages.getMessage('retrievetargetdirFlagLongDescription'),
      required: false,
    }),
    verbose: flags.builtin({
      description: messages.getMessage('verboseFlagDescription'),
      longDescription: messages.getMessage('verboseFlagLongDescription'),
    }),
    jobid: flags.id({
      char: 'i',
      description: messages.getMessage('jobidDescription'),
      longDescription: messages.getMessage('jobidLongDescription'),
      required: false,
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const MdapiRetrieveReportCommandImpl = require('../../../../lib/mdapi/mdapiRetrieveReportCommand');
    return this.execLegacyCommand(new MdapiRetrieveReportCommandImpl(context), context);
  }
  public resolveUsername(context) {
    return context.flags.jobid ? undefined : Stash.get('targetusername', Stash.Commands.MDAPI_RETRIEVE);
  }
}

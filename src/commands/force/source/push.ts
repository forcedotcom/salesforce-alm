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
import { Messages } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { ToolbeltCommand } from '../../../ToolbeltCommand';

import consts = require('../../../lib/core/constants');

Messages.importMessagesDirectory(__dirname);
const mdapiMessages: Messages = Messages.loadMessages('salesforce-alm', 'mdapi_deploy');
const messages: Messages = Messages.loadMessages('salesforce-alm', 'source_push');

export class SourcePushCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('commandDescription');
  public static readonly longDescription = messages.getMessage('commandDescriptionLong');
  public static readonly help = messages.getMessage('commandHelp');
  public static readonly showProgress = true;
  public static readonly requiresProject = true;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    forceoverwrite: flags.boolean({
      char: 'f',
      description: messages.getMessage('forceoverwriteFlagDescription'),
      longDescription: messages.getMessage('forceoverwriteFlagDescriptionLong'),
      required: false
    }),
    ignorewarnings: flags.boolean({
      char: 'g',
      description: messages.getMessage('ignorewarningsFlagDescription'),
      longDescription: messages.getMessage('ignorewarningsFlagDescriptionLong'),
      required: false
    }),
    replacetokens: flags.boolean({
      char: 'r',
      description: messages.getMessage('replacetokensFlagDescription'),
      longDescription: messages.getMessage('replacetokensFlagDescriptionLong'),
      required: false,
      hidden: true
    }),
    wait: flags.minutes({
      char: 'w',
      description: mdapiMessages.getMessage('mdapiCliWait', [consts.DEFAULT_SRC_WAIT_MINUTES]),
      longDescription: messages.getMessage('waitFlagDescriptionLong'),
      required: false,
      default: Duration.minutes(consts.DEFAULT_SRC_WAIT_MINUTES),
      min: Duration.minutes(consts.MIN_SRC_WAIT_MINUTES)
    })
  };

  public async run(): Promise<unknown> {
    const { SourceApiCommand } = require('../../../lib/source/sourceApiCommand');
    const context = await this.resolveLegacyContext();
    context.deploytype = SourceApiCommand.SOURCE_PUSH;
    return await this.execLegacyCommand(new SourceApiCommand(false), context);
  }
}

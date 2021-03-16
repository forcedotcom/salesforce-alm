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

Messages.importMessagesDirectory(__dirname);
const mdapiMessages: Messages = Messages.loadMessages('salesforce-alm', 'mdapi_deploy');
const messages: Messages = Messages.loadMessages('salesforce-alm', 'source_pull');
import consts = require('../../../lib/core/constants');

export class SourcePullCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('commandDescription');
  public static readonly longDescription = messages.getMessage('commandDescriptionLong');
  public static readonly help = messages.getMessage('commandHelp');
  public static readonly showProgress = true;
  public static readonly requiresProject = true;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    wait: flags.minutes({
      char: 'w',
      description: mdapiMessages.getMessage('mdapiCliWait', [consts.DEFAULT_SRC_WAIT_MINUTES]),
      longDescription: messages.getMessage('waitFlagDescriptionLong'),
      required: false,
      default: Duration.minutes(consts.DEFAULT_SRC_WAIT_MINUTES),
      min: Duration.minutes(consts.MIN_SRC_WAIT_MINUTES)
    }),
    forceoverwrite: flags.boolean({
      char: 'f',
      description: messages.getMessage('forceoverwriteFlagDescription'),
      longDescription: messages.getMessage('forceoverwriteFlagDescriptionLong'),
      required: false
    })
  };
  protected readonly lifecycleEventNames = ['preretrieve', 'postretrieve', 'postsourceupdate'];

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const MdapiPullCommand = require('../../../lib/source/sourcePullCommand');
    return this.execLegacyCommand(new MdapiPullCommand(), context);
  }
}

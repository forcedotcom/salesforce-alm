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
import { Duration } from '@salesforce/kit';
import { ToolbeltCommand } from '../../../ToolbeltCommand';

import consts = require('../../../lib/core/constants');
const { DEFAULT_SRC_WAIT_MINUTES, MIN_SRC_WAIT_MINUTES } = consts;

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('salesforce-alm', 'source_delete');
const commonMsgs = Messages.loadMessages('salesforce-alm', 'source');

export class SourceDeleteCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description');
  public static readonly longDescription = messages.getMessage('longDescription');
  public static readonly help = messages.getMessage('help');
  public static readonly requiresProject = true;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    checkonly: flags.boolean({
      char: 'c',
      description: messages.getMessage('deleteCommandCliCheckOnly'),
      longDescription: messages.getMessage('deleteCommandCliCheckOnlyLong'),
      required: false,
    }),
    noprompt: flags.boolean({
      char: 'r',
      required: false,
      hidden: false,
      description: messages.getMessage('noPromptParamDescription'),
      longDescription: messages.getMessage('noPromptParamLongDescription'),
    }),
    wait: flags.minutes({
      char: 'w',
      required: false,
      hidden: false,
      default: Duration.minutes(DEFAULT_SRC_WAIT_MINUTES),
      min: Duration.minutes(MIN_SRC_WAIT_MINUTES),
      description: commonMsgs.getMessage('waitParamDescription', [DEFAULT_SRC_WAIT_MINUTES]),
      longDescription: commonMsgs.getMessage('waitParamDescriptionLong'),
    }),
    sourcepath: flags.array({
      char: 'p',
      required: false,
      hidden: false,
      description: messages.getMessage('sourcePathDescription'),
      longDescription: messages.getMessage('sourcePathLongDescription'),
      exclusive: ['metadata'],
    }),
    metadata: flags.array({
      char: 'm',
      description: messages.getMessage('metadataParamDescription'),
      longDescription: messages.getMessage('metadataParamLongDescription'),
      required: false,
    }),
  };
  public async run(): Promise<unknown> {
    const { SourceApiCommand } = require('../../../lib/source/sourceApiCommand');
    const context = await this.resolveLegacyContext();
    context.deploytype = SourceApiCommand.SOURCE_DEPLOY;
    return await this.execLegacyCommand(new SourceApiCommand(true), context);
  }
}

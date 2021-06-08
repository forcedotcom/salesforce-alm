/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { flags, FlagsConfig } from '@salesforce/command';
import { Duration } from '@salesforce/kit';
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

import consts = require('../../../../lib/core/constants');
import Stash = require('../../../../lib/core/stash');
const { DEFAULT_SRC_WAIT_MINUTES, MIN_SRC_WAIT_MINUTES } = consts;

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('salesforce-alm', 'source_deploy_cancel');
const commonMsgs = Messages.loadMessages('salesforce-alm', 'source');

export class SourceDeployCancelCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description');
  public static readonly longDescription = messages.getMessage('longDescription');
  public static readonly help = messages.getMessage('help');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    wait: flags.minutes({
      char: 'w',
      required: false,
      hidden: false,
      default: Duration.minutes(DEFAULT_SRC_WAIT_MINUTES),
      min: Duration.minutes(MIN_SRC_WAIT_MINUTES),
      description: commonMsgs.getMessage('waitParamDescription', [DEFAULT_SRC_WAIT_MINUTES]),
      longDescription: commonMsgs.getMessage('waitParamDescriptionLong'),
    }),
    jobid: flags.id({
      char: 'i',
      description: messages.getMessage('jobId'),
      longDescription: messages.getMessage('jobIdLong'),
      required: false,
    }),
  };

  public async run(): Promise<unknown> {
    const { MdapiCancelCommand } = require('../../../../lib/mdapi/mdapiDeployCancelCommand');
    const context = await this.resolveLegacyContext();
    return await this.execLegacyCommand(new MdapiCancelCommand(Stash.Commands.SOURCE_DEPLOY), context);
  }
}

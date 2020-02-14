/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ToolbeltCommand } from '../../../../ToolbeltCommand';
import { Messages } from '@salesforce/core';
import { flags, FlagsConfig } from '@salesforce/command';
import { Duration } from '@salesforce/kit';

import consts = require('../../../../lib/core/constants');
import Stash = require('../../../../lib/core/stash');
const { DEFAULT_SRC_WAIT_MINUTES, MIN_SRC_WAIT_MINUTES } = consts;

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('salesforce-alm', 'source_deploy_report');
const commonMsgs = Messages.loadMessages('salesforce-alm', 'source');

export class SourceDeployReportCommand extends ToolbeltCommand {
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
      longDescription: commonMsgs.getMessage('waitParamDescriptionLong')
    }),
    jobid: flags.id({
      char: 'i',
      description: messages.getMessage('jobId'),
      longDescription: messages.getMessage('jobIdLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const MdapiDeployReportCommand = require('../../../../lib/mdapi/mdapiDeployReportCommand');
    return this.execLegacyCommand(new MdapiDeployReportCommand(context, Stash.Commands.SOURCE_DEPLOY), context);
  }
}

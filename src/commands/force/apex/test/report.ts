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
import { Duration } from '@salesforce/kit';
import Messages = require('../../../../lib/messages');
import { ReporterCommand } from '../../../../ReporterCommand';

const messages = Messages();
import consts = require('../../../../lib/core/constants');

export class ApexTestReportCommand extends ReporterCommand {
  public static readonly theDescription = messages.getMessage('apexReportCommandDescription', [], 'apex');
  public static readonly longDescription = messages.getMessage('apexReportCommandDescriptionLong', [], 'apex');
  public static readonly help = messages.getMessage('apexReportCommandHelp', [], 'apex');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly resultFormatOptions = { options: ['human', 'tap', 'junit', 'json'], default: 'human' };
  public static readonly flagsConfig: FlagsConfig = {
    testrunid: flags.id({
      char: 'i',
      description: messages.getMessage('apexReportCommandParamTestRunId', [], 'apex'),
      longDescription: messages.getMessage('apexReportCommandParamTestRunIdLong', [], 'apex'),
      required: true
    }),
    codecoverage: flags.boolean({
      char: 'c',
      description: messages.getMessage('apexCommandParamCodeCoverage', [], 'apex'),
      longDescription: messages.getMessage('apexCommandParamCodeCoverageLong', [], 'apex'),
      required: false
    }),
    outputdir: flags.directory({
      char: 'd',
      description: messages.getMessage('apexCommandParamTestArtifactDir', [], 'apex'),
      longDescription: messages.getMessage('apexCommandParamTestArtifactDirLong', [], 'apex'),
      required: false
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('streamingWait', []),
      longDescription: messages.getMessage('streamingWaitLong', []),
      required: false,
      min: Duration.minutes(consts.MIN_STREAM_TIMEOUT_MINUTES),
      default: Duration.minutes(consts.DEFAULT_STREAM_TIMEOUT_MINUTES)
    }),
    verbose: flags.builtin({
      description: messages.getMessage('verboseDescription', [], 'apex'),
      longDescription: messages.getMessage('verboseLongDescription', [], 'apex')
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const Command = require('../../../../lib/apex/apexReportCommand');
    return this.execLegacyCommand(new Command(), context);
  }
}

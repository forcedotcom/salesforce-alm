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
import { Duration } from '@salesforce/kit';
import Messages = require('../../../../lib/messages');
import { ReporterCommand } from '../../../../ReporterCommand';

const messages = Messages();
import consts = require('../../../../lib/core/constants');

export class ApexTestRunCommand extends ReporterCommand {
  public static readonly theDescription = messages.getMessage('apexTestCommandDescription', [], 'apex');
  public static readonly longDescription = messages.getMessage('apexTestCommandDescriptionLong', [], 'apex');
  public static readonly help = messages.getMessage('apexTestCommandHelp', [], 'apex');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly resultFormatOptions = { options: ['human', 'tap', 'junit', 'json'] };
  public static readonly flagsConfig: FlagsConfig = {
    classnames: flags.array({
      char: 'n',
      description: messages.getMessage('apexTestCommandParamTestNames', [], 'apex'),
      longDescription: messages.getMessage('apexTestCommandParamTestNamesLong', [], 'apex'),
      required: false,
      exclusive: ['suitenames', 'tests']
    }),
    suitenames: flags.array({
      char: 's',
      description: messages.getMessage('apexTestCommandParamTestSuites', [], 'apex'),
      longDescription: messages.getMessage('apexTestCommandParamTestSuitesLong', [], 'apex'),
      required: false
    }),
    tests: flags.array({
      char: 't',
      description: messages.getMessage('apexTestCommandParamTests', [], 'apex'),
      longDescription: messages.getMessage('apexTestCommandParamTestsLong', [], 'apex'),
      required: false
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
    testlevel: flags.enum({
      char: 'l',
      description: messages.getMessage('apexTestCommandParamTestLevel', [], 'apex'),
      longDescription: messages.getMessage('apexTestCommandParamTestLevelLong', [], 'apex'),
      required: false,
      options: ['RunLocalTests', 'RunAllTestsInOrg', 'RunSpecifiedTests']
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('streamingWait', []),
      longDescription: messages.getMessage('streamingWaitLong', []),
      required: false,
      min: Duration.minutes(consts.MIN_STREAM_TIMEOUT_MINUTES)
    }),
    precompilewait: flags.minutes({
      description: messages.getMessage('precompileDescription', [], 'apexPreCompileCommand'),
      longDescription: messages.getMessage('precompileLongDescription', [], 'apexPreCompileCommand'),
      required: false,
      hidden: true,
      min: Duration.minutes(consts.DEFAULT_TIMEOUT.minutes)
    }),
    synchronous: flags.boolean({
      char: 'y',
      description: messages.getMessage('apexTestCommandParamSynchronous', [], 'apex'),
      longDescription: messages.getMessage('apexTestCommandParamSynchronousLong', [], 'apex'),
      required: false
    }),
    verbose: flags.builtin({
      description: messages.getMessage('verboseDescription', [], 'apex'),
      longDescription: messages.getMessage('verboseLongDescription', [], 'apex')
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const Command = require('../../../../lib/apex/apexTestCommand');
    return this.execLegacyCommand(new Command(), context);
  }
}

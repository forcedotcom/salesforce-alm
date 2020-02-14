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
import Messages = require('../../../../lib/messages');
import { ReporterCommand } from '../../../../ReporterCommand';

const messages = Messages();

export class LightningTestRunCommand extends ReporterCommand {
  public static readonly theDescription = messages.getMessage('lightningTestCommandDescription', [], 'lightning_test');
  public static readonly longDescription = messages.getMessage(
    'lightningTestCommandDescriptionLong',
    [],
    'lightning_test'
  );
  public static readonly help = messages.getMessage('lightningTestCommandHelp', [], 'lightning_test');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly resultFormatOptions = { options: ['human', 'tap', 'junit', 'json'], default: 'human' };
  public static readonly flagsConfig: FlagsConfig = {
    appname: flags.string({
      char: 'a',
      description: messages.getMessage('lightningTestCommandParamAppName', [], 'lightning_test'),
      longDescription: messages.getMessage('lightningTestCommandParamAppNameLong', [], 'lightning_test'),
      required: false
    }),
    outputdir: flags.directory({
      char: 'd',
      description: messages.getMessage('lightningCommandParamTestArtifactDir', [], 'lightning_test'),
      longDescription: messages.getMessage('lightningCommandParamTestArtifactDirLong', [], 'lightning_test'),
      required: false
    }),
    configfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('lightningTestCommandParamConfig', [], 'lightning_test'),
      longDescription: messages.getMessage('lightningTestCommandParamConfigLong', [], 'lightning_test'),
      required: false
    }),
    leavebrowseropen: flags.boolean({
      char: 'o',
      description: messages.getMessage('lightningTestCommandParamLeaveBrowserOpen', [], 'lightning_test'),
      longDescription: messages.getMessage('lightningTestCommandParamLeaveBrowserOpenLong', [], 'lightning_test'),
      required: false
    }),
    timeout: flags.number({
      char: 't',
      description: messages.getMessage('lightningTestCommandParamTimeout', [], 'lightning_test'),
      longDescription: messages.getMessage('lightningTestCommandParamTimeoutLong', [], 'lightning_test'),
      required: false,
      default: 60000
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const LightningTestCommand = require('../../../../lib/lightning/lightningTestCommand');
    return this.execLegacyCommand(new LightningTestCommand(), context);
  }
}

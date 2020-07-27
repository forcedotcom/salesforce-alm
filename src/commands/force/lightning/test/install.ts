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
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();

export class LightningTestInstallCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage(
    'lightningTestInstallCommandDescription',
    [],
    'lightning_test'
  );
  public static readonly longDescription = messages.getMessage(
    'lightningTestInstallCommandDescriptionLong',
    [],
    'lightning_test'
  );
  public static deprecated = {
    version: 50.0,
    message: messages.getMessage('lightningTestingServiceDeprecated', [], 'lightning_test')
  };
  public static readonly help = messages.getMessage('lightningTestInstallCommandHelp', [], 'lightning_test');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('lightningTestInstallCommandParamWait', [], 'lightning_test'),
      longDescription: messages.getMessage('lightningTestInstallCommandParamWaitLong', [], 'lightning_test'),
      required: false,
      default: Duration.minutes(2)
    }),
    releaseversion: flags.string({
      char: 'r',
      description: messages.getMessage('lightningTestInstallCommandParamVersion', [], 'lightning_test'),
      longDescription: messages.getMessage('lightningTestInstallCommandParamVersionLong', [], 'lightning_test'),
      required: false,
      default: 'latest'
    }),
    packagetype: flags.enum({
      char: 't',
      description: messages.getMessage('lightningTestInstallCommandParamType', [], 'lightning_test'),
      longDescription: messages.getMessage('lightningTestInstallCommandParamTypeLong', [], 'lightning_test'),
      required: false,
      default: 'full',
      options: ['jasmine', 'mocha', 'full']
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const LightningTestInstallCommand = require('../../../../lib/lightning/lightningTestInstallCommand');
    return this.execLegacyCommand(new LightningTestInstallCommand(), context);
  }
}

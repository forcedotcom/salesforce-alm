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
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();

export class ConfigSetCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'configSetCommand');
  public static readonly longDescription = messages.getMessage('descriptionLong', [], 'configSetCommand');
  public static readonly help = messages.getMessage('help', [], 'configSetCommand');
  public static readonly requiresProject = false;
  public static readonly varargs = { required: true };
  public static readonly flagsConfig: FlagsConfig = {
    global: flags.boolean({
      char: 'g',
      description: messages.getMessage('global', [], 'configSetCommand'),
      longDescription: messages.getMessage('globalLong', [], 'configSetCommand'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const ConfigSetCommand = require('../../../lib/config/ConfigSetCommand');
    return this.execLegacyCommand(new ConfigSetCommand(), context);
  }
}

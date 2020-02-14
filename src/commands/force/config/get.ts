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
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();

export class ConfigGetCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'configGetCommand');
  public static readonly longDescription = messages.getMessage('descriptionLong', [], 'configGetCommand');
  public static readonly help = messages.getMessage('help', [], 'configGetCommand');
  public static readonly requiresProject = false;
  public static readonly strict = false;
  public static readonly flagsConfig: FlagsConfig = {
    verbose: flags.builtin()
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const ConfigGetCommand = require('../../../lib/config/ConfigGetCommand');
    return this.execLegacyCommand(new ConfigGetCommand(), context);
  }
}

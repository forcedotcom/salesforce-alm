/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();

export class ConfigListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'configListCommand');
  public static readonly longDescription = messages.getMessage('descriptionLong', [], 'configListCommand');
  public static readonly help = messages.getMessage('help', [], 'configListCommand');
  public static readonly requiresProject = false;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const ConfigListCommand = require('../../../lib/config/ConfigListCommand');
    return this.execLegacyCommand(new ConfigListCommand(), context);
  }
}

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
import messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const { getMessage } = messages();

export class UserCreateCommand extends ToolbeltCommand {
  public static readonly theDescription = getMessage('description', [], 'user_create');
  public static readonly longDescription = getMessage('longDescription', [], 'user_create');
  public static readonly help = getMessage('help', [], 'user_create');
  public static readonly requiresProject = false;
  public static readonly varargs = true;
  public static readonly requiresUsername = true;
  public static readonly supportsDevhubUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    definitionfile: flags.filepath({
      char: 'f',
      description: getMessage('definitionfileParam', [], 'user_create'),
      longDescription: getMessage('definitionfileParamLong', [], 'user_create'),
      required: false
    }),
    setalias: flags.string({
      char: 'a',
      description: getMessage('setaliasParam', [], 'user_create'),
      longDescription: getMessage('setaliasParamLong', [], 'user_create'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { UserCreateCommand } = require('../../../lib/user/userCreateCommand');
    return await this.execLegacyCommand(new UserCreateCommand(), context);
  }
}

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
import messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const { getMessage } = messages();

export class UserPasswordGenerateCommand extends ToolbeltCommand {
  public static readonly theDescription = getMessage('description', [], 'generatePassword');
  public static readonly longDescription = getMessage('longDescription', [], 'generatePassword');
  public static readonly help = getMessage('help', [], 'generatePassword');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly requiresDevhubUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    onbehalfof: flags.array({
      char: 'o',
      description: getMessage('onbehalfofParam', [], 'generatePassword'),
      longDescription: getMessage('onbehalfofParamLong', [], 'generatePassword'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { UserPasswordGenerateCommand } = require('../../../../lib/user/userPasswordGenerateCommand');
    return await this.execLegacyCommand(new UserPasswordGenerateCommand(), context);
  }
}

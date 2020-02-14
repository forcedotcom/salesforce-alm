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
import messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const { getMessage } = messages();

export class UserPermsetAssignCommand extends ToolbeltCommand {
  public static readonly theDescription = getMessage('assignCommandCliDescription');
  public static readonly longDescription = getMessage('assignCommandCliDescriptionLong');
  public static readonly help = getMessage('assignCommandCliHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    permsetname: flags.string({
      char: 'n',
      description: getMessage('assignCommandCliName'),
      longDescription: getMessage('assignCommandCliNameLong'),
      required: true
    }),
    onbehalfof: flags.array({
      char: 'o',
      description: getMessage('assignCommandOnBehalfOf'),
      longDescription: getMessage('assignCommandOnBehalfOfLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { UserPermsetAssignCommand } = require('../../../../lib/user/userPermsetAssignCommand');
    return await this.execLegacyCommand(new UserPermsetAssignCommand(), context);
  }
}

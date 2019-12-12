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
import * as Messages from '../../../lib/force-cli/force-cli-messages';
import { ToolbeltCommand } from '../../../ToolbeltCommand';

export class ApexExecuteCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('ApexExecDescription');
  public static readonly longDescription = Messages.get('ApexExecLongDescription');
  public static readonly help = Messages.get('ApexExecHelp');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    apexcodefile: flags.filepath({
      char: 'f',
      required: false,
      hidden: false,
      description: Messages.get('ApexExecFilePathDescription'),
      longDescription: Messages.get('ApexExecFilePathLongDescription')
    })
  };

  public static readonly requiresUsername = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { ApexExecuteCommand } = require('../../../lib/apex/apexExecuteCommand');
    return await this.execLegacyCommand(new ApexExecuteCommand(), context);
  }
}

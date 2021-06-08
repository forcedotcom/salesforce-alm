/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import * as Messages from '../../../../lib/force-cli/force-cli-messages';
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

export class ApexLogTailCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('ApexLogTailDescription');
  public static readonly longDescription = Messages.get('ApexLogTailLongDescription');
  public static readonly help = Messages.get('ApexLogTailHelp');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    color: flags.boolean({
      char: 'c',
      required: false,
      hidden: false,
      description: Messages.get('ApexLogTailColorizeDescription'),
      longDescription: Messages.get('ApexLogTailColorizeLongDescription'),
    }),
    debuglevel: flags.string({
      char: 'd',
      required: false,
      hidden: false,
      description: Messages.get('ApexLogTailDebugLevelDescription'),
      longDescription: Messages.get('ApexLogTailDebugLevelLongDescription'),
    }),
    skiptraceflag: flags.boolean({
      char: 's',
      required: false,
      hidden: false,
      description: Messages.get('ApexLogTailSkipTraceFlagDescription'),
      longDescription: Messages.get('ApexLogTailSkipTraceFlagLongDescription'),
    }),
  };

  public static readonly requiresUsername = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const { ApexLogTailCommand } = require('../../../../lib/apex/apexLogTailCommand');
    return await this.execLegacyCommand(new ApexLogTailCommand(), context);
  }
}

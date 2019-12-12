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
import * as Messages from '../../../../lib/force-cli/force-cli-messages';
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

export class ApexLogGetCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('ApexLogGetDescription');
  public static readonly longDescription = Messages.get('ApexLogGetLongDescription');
  public static readonly help = Messages.get('ApexLogGetHelp');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    color: flags.boolean({
      char: 'c',
      required: false,
      hidden: false,
      description: Messages.get('ApexLogTailColorizeDescription'),
      longDescription: Messages.get('ApexLogTailColorizeLongDescription')
    }),
    logid: flags.id({
      char: 'i',
      required: false,
      hidden: false,
      description: Messages.get('ApexLogGetIdDescription'),
      longDescription: Messages.get('ApexLogGetIdLongDescription'),
      exclusive: ['number']
    }),
    number: flags.number({
      char: 'n',
      required: false,
      hidden: false,
      min: 1,
      max: 25,
      description: Messages.get('ApexLogGetLastNumberDescription'),
      longDescription: Messages.get('ApexLogGetLastNumberLongDescription')
    })
  };

  public static readonly requiresUsername = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { ApexLogGetCommand } = require('../../../../lib/apex/apexLogGetCommand');
    return await this.execLegacyCommand(new ApexLogGetCommand(), context);
  }
}

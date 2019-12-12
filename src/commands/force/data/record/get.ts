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

export class DataRecordGetCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('DataRecordGetDescription');
  public static readonly longDescription = Messages.get('DataRecordGetLongDescription');
  public static readonly help = Messages.get('DataRecordGetHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly supportsPerfLogLevelFlag = true;

  public static readonly flagsConfig: FlagsConfig = {
    sobjecttype: flags.string({
      char: 's',
      required: true,
      hidden: false,
      description: Messages.get('DataRecordGetSobjectDescription'),
      longDescription: Messages.get('DataRecordGetSobjectLongDescription')
    }),
    sobjectid: flags.id({
      char: 'i',
      required: false,
      hidden: false,
      description: Messages.get('DataRecordGetIdDescription'),
      longDescription: Messages.get('DataRecordGetIdLongDescription')
    }),
    where: flags.string({
      char: 'w',
      required: false,
      hidden: false,
      description: Messages.get('DataRecordWhereDescription'),
      longDescription: Messages.get('DataRecordWhereLongDescription')
    }),
    usetoolingapi: flags.boolean({
      char: 't',
      required: false,
      hidden: false,
      description: Messages.get('DataRecordGetToolingDescription'),
      longDescription: Messages.get('DataRecordGetToolingLongDescription')
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { DataRecordGetCommand } = require('../../../../lib/data/dataRecordGetCommand');
    return await this.execLegacyCommand(new DataRecordGetCommand(), context);
  }
}

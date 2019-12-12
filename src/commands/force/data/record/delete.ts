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

export class DataRecordDeleteCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('DataRecordDeleteDescription');
  public static readonly longDescription = Messages.get('DataRecordDeleteLongDescription');
  public static readonly help = Messages.get('DataRecordDeleteHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly supportsPerfLogLevelFlag = true;

  public static readonly flagsConfig: FlagsConfig = {
    sobjecttype: flags.string({
      char: 's',
      required: true,
      hidden: false,
      description: Messages.get('DataRecordDeleteSobjectDescription'),
      longDescription: Messages.get('DataRecordDeleteSobjectLongDescription')
    }),
    sobjectid: flags.id({
      char: 'i',
      required: false,
      hidden: false,
      description: Messages.get('DataRecordDeleteIdDescription'),
      longDescription: Messages.get('DataRecordDeleteIdLongDescription')
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
      description: Messages.get('DataRecordDeleteToolingDescription'),
      longDescription: Messages.get('DataRecordDeleteToolingLongDescription')
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { DataRecordDeleteCommand } = require('../../../../lib/data/dataRecordDeleteCommand');
    return await this.execLegacyCommand(new DataRecordDeleteCommand(), context);
  }
}

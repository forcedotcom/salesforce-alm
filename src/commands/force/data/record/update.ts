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
import * as Messages from '../../../../lib/force-cli/force-cli-messages';
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

export class DataRecordUpdateCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('DataRecordUpdateDescription');
  public static readonly longDescription = Messages.get('DataRecordUpdateLongDescription');
  public static readonly help = Messages.get('DataRecordUpdateHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly supportsPerfLogLevelFlag = true;

  public static readonly flagsConfig: FlagsConfig = {
    sobjecttype: flags.string({
      char: 's',
      required: true,
      hidden: false,
      description: Messages.get('DataRecordUpdateSobjectDescription'),
      longDescription: Messages.get('DataRecordUpdateSobjectLongDescription')
    }),
    sobjectid: flags.id({
      char: 'i',
      required: false,
      hidden: false,
      description: Messages.get('DataRecordUpdateIdDescription'),
      longDescription: Messages.get('DataRecordUpdateIdLongDescription')
    }),
    where: flags.string({
      char: 'w',
      required: false,
      hidden: false,
      description: Messages.get('DataRecordWhereDescription'),
      longDescription: Messages.get('DataRecordWhereLongDescription')
    }),
    values: flags.string({
      char: 'v',
      required: true,
      hidden: false,
      description: Messages.get('DataRecordUpdateValuesDescription'),
      longDescription: Messages.get('DataRecordUpdateValuesLongDescription')
    }),
    usetoolingapi: flags.boolean({
      char: 't',
      required: false,
      hidden: false,
      description: Messages.get('DataRecordUpdateToolingDescription'),
      longDescription: Messages.get('DataRecordUpdateToolingLongDescription')
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { DataRecordUpdateCommand } = require('../../../../lib/data/dataRecordUpdateCommand');
    return await this.execLegacyCommand(new DataRecordUpdateCommand(), context);
  }
}

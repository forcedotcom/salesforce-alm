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

export class DataRecordCreateCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('DataRecordCreateDescription');
  public static readonly longDescription = Messages.get('DataRecordCreateLongDescription');
  public static readonly help = Messages.get('DataRecordCreateHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly supportsPerfLogLevelFlag = true;

  public static readonly flagsConfig: FlagsConfig = {
    sobjecttype: flags.string({
      char: 's',
      required: true,
      hidden: false,
      description: Messages.get('DataRecordCreateSobjectDescription'),
      longDescription: Messages.get('DataRecordCreateSobjectLongDescription')
    }),
    values: flags.string({
      char: 'v',
      required: true,
      hidden: false,
      description: Messages.get('DataRecordCreateValuesDescription'),
      longDescription: Messages.get('DataRecordCreateValuesLongDescription')
    }),
    usetoolingapi: flags.boolean({
      char: 't',
      required: false,
      hidden: false,
      description: Messages.get('DataRecordCreateToolingDescription'),
      longDescription: Messages.get('DataRecordCreateToolingLongDescription')
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { DataRecordCreateCommand } = require('../../../../lib/data/dataRecordCreateCommand');
    return await this.execLegacyCommand(new DataRecordCreateCommand(), context);
  }
}

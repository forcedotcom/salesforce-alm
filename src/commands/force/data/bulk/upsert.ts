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

export class DataBulkUpsertCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('DataBulkUpsertDescription');
  public static readonly longDescription = Messages.get('DataBulkUpsertLongDescription');
  public static readonly help = Messages.get('DataBulkUpsertHelp');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    sobjecttype: flags.string({
      char: 's',
      required: true,
      hidden: false,
      description: Messages.get('DataBulkUpsertSobjectTypeDescription'),
      longDescription: Messages.get('DataBulkUpsertSobjectTypeLongDescription')
    }),
    csvfile: flags.filepath({
      char: 'f',
      required: true,
      hidden: false,
      description: Messages.get('DataBulkUpsertCsvFilePathDescription'),
      longDescription: Messages.get('DataBulkUpsertCsvFilePathLongDescription')
    }),
    externalid: flags.string({
      char: 'i',
      required: true,
      hidden: false,
      description: Messages.get('DataBulkUpsertExternalIdDescription'),
      longDescription: Messages.get('DataBulkUpsertExternalIdLongDescription')
    }),
    wait: flags.minutes({
      char: 'w',
      required: false,
      hidden: false,
      min: 0,
      description: Messages.get('DataBulkUpsertWaitDescription'),
      longDescription: Messages.get('DataBulkUpsertWaitLongDescription')
    })
  };

  public static readonly requiresUsername = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { DataBulkUpsertCommand } = require('../../../../lib/data/dataBulkUpsertCommand');
    return await this.execLegacyCommand(new DataBulkUpsertCommand(), context);
  }
}

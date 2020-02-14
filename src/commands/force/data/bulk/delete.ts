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

export class DataBulkDeleteCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('DataBulkDeleteDescription');
  public static readonly longDescription = Messages.get('DataBulkDeleteLongDescription');
  public static readonly help = Messages.get('DataBulkDeleteHelp');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    sobjecttype: flags.string({
      char: 's',
      required: true,
      hidden: false,
      description: Messages.get('DataBulkDeleteSobjectTypeDescription'),
      longDescription: Messages.get('DataBulkDeleteSobjectTypeLongDescription')
    }),
    csvfile: flags.filepath({
      char: 'f',
      required: true,
      hidden: false,
      description: Messages.get('DataBulkDeleteCsvFilePathDescription'),
      longDescription: Messages.get('DataBulkDeleteCsvFilePathLongDescription')
    }),
    wait: flags.minutes({
      char: 'w',
      required: false,
      hidden: false,
      description: Messages.get('DataBulkDeleteWaitDescription'),
      longDescription: Messages.get('DataBulkDeleteWaitLongDescription')
    })
  };

  public static readonly requiresUsername = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { DataBulkDeleteCommand } = require('../../../../lib/data/dataBulkDeleteCommand');
    return await this.execLegacyCommand(new DataBulkDeleteCommand(), context);
  }
}

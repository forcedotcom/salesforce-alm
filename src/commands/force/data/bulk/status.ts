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

export class DataBulkStatusCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('DataBulkStatusDescription');
  public static readonly longDescription = Messages.get('DataBulkStatusLongDescription');
  public static readonly help = Messages.get('DataBulkStatusHelp');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    jobid: flags.id({
      char: 'i',
      required: true,
      hidden: false,
      description: Messages.get('DataBulkStatusJobIdDescription'),
      longDescription: Messages.get('DataBulkStatusJobIdLongDescription')
    }),
    batchid: flags.id({
      char: 'b',
      required: false,
      hidden: false,
      description: Messages.get('DataBulkStatusBatchIdDescription'),
      longDescription: Messages.get('DataBulkStatusBatchIdLongDescription')
    })
  };

  public static readonly requiresUsername = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { DataBulkStatusCommand } = require('../../../../lib/data/dataBulkStatusCommand');
    return await this.execLegacyCommand(new DataBulkStatusCommand(), context);
  }
}

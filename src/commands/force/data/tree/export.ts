/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

/**
 * Command that provides data export capability.
 */

import { flags, FlagsConfig } from '@salesforce/command';
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();

export class DataTreeExportCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('dataExportCommandCliDescription', [], 'data');
  public static readonly longDescription = messages.getMessage('dataExportCommandCliDescriptionLong', [], 'data');
  public static readonly help = messages.getMessage('dataExportCommandCliHelp', [], 'data');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    query: flags.string({
      char: 'q',
      description: messages.getMessage('dataExportCommandCliSoql', [], 'data'),
      longDescription: messages.getMessage('dataExportCommandCliSoqlLong', [], 'data'),
      required: true
    }),
    plan: flags.boolean({
      char: 'p',
      description: messages.getMessage('dataExportCommandCliPlan', [], 'data'),
      longDescription: messages.getMessage('dataExportCommandCliPlanLong', [], 'data'),
      required: false
    }),
    prefix: flags.string({
      char: 'x',
      description: messages.getMessage('dataExportCommandCliPrefix', [], 'data'),
      longDescription: messages.getMessage('dataExportCommandCliPrefixLong', [], 'data'),
      required: false
    }),
    outputdir: flags.directory({
      char: 'd',
      description: messages.getMessage('dataExportCommandCliDir', [], 'data'),
      longDescription: messages.getMessage('dataExportCommandCliDirLong', [], 'data'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const DataExportCommand = require('../../../../lib/data/dataExportCommand');
    return this.execLegacyCommand(new DataExportCommand(), context);
  }
}

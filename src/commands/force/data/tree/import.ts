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
 * Command that provides data import capability.
 */

import { flags, FlagsConfig } from '@salesforce/command';
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();

export class DataTreeImportCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('dataImportCommandCliDescription', [], 'data');
  public static readonly longDescription = messages.getMessage('dataImportCommandCliDescriptionLong', [], 'data');
  public static readonly help = messages.getMessage('dataImportCommandCliHelp', [], 'data');
  public static readonly schema = {
    name: 'dataImportPlanSchema.json',
    flag: 'plan'
  };
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    sobjecttreefiles: flags.array({
      char: 'f',
      description: messages.getMessage('dataImportCommandCliFiles', [], 'data'),
      longDescription: messages.getMessage('dataImportCommandCliFilesLong', [], 'data'),
      required: false,
      exclusive: ['plan']
    }),
    plan: flags.filepath({
      char: 'p',
      description: messages.getMessage('dataImportCommandCliPlan', [], 'data'),
      longDescription: messages.getMessage('dataImportCommandCliPlanLong', [], 'data'),
      required: false
    }),
    contenttype: flags.string({
      char: 'c',
      description: messages.getMessage('dataImportCommandCliContentType', [], 'data'),
      longDescription: messages.getMessage('dataImportCommandCliContentTypeLong', [], 'data'),
      required: false,
      hidden: true
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const DataImportCommand = require('../../../../lib/data/dataImportCommand');
    const DataImportConfigHelpCommand = require('../../../../lib/data/dataImportConfigHelpCommand');
    const dataImport = context.flags.confighelp ? new DataImportConfigHelpCommand() : new DataImportCommand();
    return this.execLegacyCommand(dataImport, context);
  }
}

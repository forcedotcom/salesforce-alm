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
import { ReporterCommand } from '../../../../ReporterCommand';

export class DataSoqlQueryCommand extends ReporterCommand {
  public static readonly theDescription = Messages.get('DataSOQLQueryDescription');
  public static readonly longDescription = Messages.get('DataSOQLQueryLongDescription');
  public static readonly help = Messages.get('DataSOQLQueryHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly supportsPerfLogLevelFlag = true;
  public static readonly resultFormatOptions = { default: 'human' };

  public static readonly flagsConfig: FlagsConfig = {
    query: flags.string({
      char: 'q',
      required: true,
      hidden: false,
      description: Messages.get('DataSOQLQueryQueryDescription'),
      longDescription: Messages.get('DataSOQLQueryQueryLongDescription')
    }),
    usetoolingapi: flags.boolean({
      char: 't',
      required: false,
      hidden: false,
      description: Messages.get('DataSOQLQueryToolingDescription'),
      longDescription: Messages.get('DataSOQLQueryToolingLongDescription')
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { DataSoqlQueryCommand } = require('../../../../lib/data/dataSoqlQueryCommand');
    return await this.execLegacyCommand(new DataSoqlQueryCommand(), context);
  }
}

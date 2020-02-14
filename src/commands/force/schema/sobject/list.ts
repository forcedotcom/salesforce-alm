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

export class SchemaSobjectListCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('SchemaSObjectListDescription');
  public static readonly longDescription = Messages.get('SchemaSObjectListLongDescription');
  public static readonly help = Messages.get('SchemaSObjectListHelp');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    sobjecttypecategory: flags.string({
      char: 'c',
      required: true,
      hidden: false,
      description: Messages.get('SchemaSObjectListTypeDescription'),
      longDescription: Messages.get('SchemaSObjectListTypeLongDescription')
    })
  };

  public static readonly requiresUsername = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { SchemaSObjectListCommand } = require('../../../../lib/schema/schemaSObjectListCommand');
    return await this.execLegacyCommand(new SchemaSObjectListCommand(), context);
  }
}

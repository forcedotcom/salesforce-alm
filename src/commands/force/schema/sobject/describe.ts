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

export class SchemaSobjectDescribeCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('SchemaSObjectDescribeDescription');
  public static readonly longDescription = Messages.get('SchemaSObjectDescribeLongDescription');
  public static readonly help = Messages.get('SchemaSObjectDescribeHelp');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    sobjecttype: flags.string({
      char: 's',
      required: true,
      hidden: false,
      description: Messages.get('SchemaSObjectDescribeObjectNameDescription'),
      longDescription: Messages.get('SchemaSObjectDescribeObjectNameLongDescription')
    }),
    usetoolingapi: flags.boolean({
      char: 't',
      required: false,
      hidden: false,
      description: Messages.get('SchemaSObjectDescribeToolingDescription'),
      longDescription: Messages.get('SchemaSObjectDescribeToolingLongDescription')
    })
  };

  public static readonly requiresUsername = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { SchemaSObjectDescribeCommand } = require('../../../../lib/schema/schemaSObjectDescribeCommand');
    return await this.execLegacyCommand(new SchemaSObjectDescribeCommand(), context);
  }
}

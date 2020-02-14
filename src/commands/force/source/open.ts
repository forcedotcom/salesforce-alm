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
import * as Messages from '../../../lib/force-cli/force-cli-messages';
import { ToolbeltCommand } from '../../../ToolbeltCommand';

export class SourceOpenCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('SourceOpenDescription');
  public static readonly longDescription = Messages.get('SourceOpenLongDescription');
  public static readonly help = Messages.get('SourceOpenHelp');
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    sourcefile: flags.filepath({
      char: 'f',
      required: true,
      hidden: false,
      description: Messages.get('SourceOpenFileDescription'),
      longDescription: Messages.get('SourceOpenFileLongDescription')
    }),
    urlonly: flags.boolean({
      char: 'r',
      required: false,
      hidden: false,
      description: Messages.get('SourceOpenPathDescription'),
      longDescription: Messages.get('SourceOpenPathLongDescription')
    })
  };

  public static readonly requiresUsername = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { SourceOpenCommand } = require('../../../lib/source/sourceOpenCommand');
    return await this.execLegacyCommand(new SourceOpenCommand(), context);
  }
}

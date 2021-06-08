/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();

export class Package1VersionDisplayCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('package1VersionDisplayCommandCliDescription');
  public static readonly longDescription = messages.getMessage('package1VersionDisplayCommandLongDescription');
  public static readonly help = messages.getMessage('package1VersionDisplayCommandCliHelp');
  public static readonly requiresUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    packageversionid: flags.id({
      char: 'i',
      description: messages.getMessage('package1VersionDisplayCommandPackageId'),
      longDescription: messages.getMessage('package1VersionDisplayCommandPackageIdLong'),
      required: true,
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const Package1VersionDisplayCommand = require('../../../../lib/package1/package1VersionDisplayCommand');
    return this.execLegacyCommand(new Package1VersionDisplayCommand(context.org), context);
  }
}

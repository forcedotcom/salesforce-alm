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
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();

export class Package1VersionListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('package1VersionListCommandCliDescription');
  public static readonly longDescription = messages.getMessage('package1VersionListCommandLongDescription');
  public static readonly help = messages.getMessage('package1VersionListCommandCliHelp');
  public static readonly supportsUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    packageid: flags.id({
      char: 'i',
      description: messages.getMessage('package1VersionListCommandPackageId'),
      longDescription: messages.getMessage('package1VersionListCommandPackageIdLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const Package1VersionListCommand = require('../../../../lib/package1/package1VersionListCommand');
    return this.execLegacyCommand(new Package1VersionListCommand(context.org), context);
  }
}

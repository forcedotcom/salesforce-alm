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
import { Messages } from '@salesforce/core';
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('salesforce-alm', 'package_hammertest_list');

export class PackageHammertestListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription');
  public static readonly longDescription = messages.getMessage('cliLongDescription');
  public static readonly help = messages.getMessage('help');
  public static readonly requiresUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    packageversionid: flags.id({
      char: 'i',
      description: messages.getMessage('packageversionid'),
      longDescription: messages.getMessage('packageversionidLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const HammerTestListCommand = require('../../../../lib/package/hammerTestListCommand');
    return this.execLegacyCommand(new HammerTestListCommand(), context);
  }
}

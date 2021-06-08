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
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();
import consts = require('../../../lib/core/constants');

export class PackageListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_list');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_list');
  public static readonly help = messages.getMessage('help', [], 'package_list');
  public static readonly requiresProject = false;
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    verbose: flags.builtin({
      description: messages.getMessage('verboseDescription', [], 'package_list'),
      longDescription: messages.getMessage('verboseLongDescription', [], 'package_list'),
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageListCommand = require('../../../lib/package/packageListCommand');
    return this.execLegacyCommand(new PackageListCommand(), context);
  }
}

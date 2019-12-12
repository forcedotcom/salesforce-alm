/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();
import consts = require('../../../../lib/core/constants');

export class PackageInstalledListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_installed_list');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_installed_list');
  public static readonly help = messages.getMessage('help', [], 'package_installed_list');
  public static readonly orgType = consts.DEFAULT_USERNAME;
  public static readonly requiresUsername = true;
  public static readonly requiresProject = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const packageInstalledListCommand = require('../../../../lib/package/packageInstalledListCommand');

    return this.execLegacyCommand(new packageInstalledListCommand.packageInstalledListCommand(), context);
  }
}

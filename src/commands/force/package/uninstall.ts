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
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();
import consts = require('../../../lib/core/constants');

export class PackageUninstallCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_uninstall');
  public static readonly longDescription = messages.getMessage('cliDescriptionLong', [], 'package_uninstall');
  public static readonly help = messages.getMessage('help', [], 'package_uninstall');
  public static readonly requiresProject = false;
  public static readonly orgType = consts.DEFAULT_USERNAME;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('wait', [], 'package_uninstall'),
      longDescription: messages.getMessage('waitLong', [], 'package_uninstall'),
      required: false
    }),
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package', [], 'package_uninstall'),
      longDescription: messages.getMessage('packageLong', [], 'package_uninstall'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageUninstallCommand = require('../../../lib/package/packageUninstallCommand');
    return this.execLegacyCommand(new PackageUninstallCommand(), context);
  }
}

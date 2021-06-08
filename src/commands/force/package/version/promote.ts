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
import consts = require('../../../../lib/core/constants');

export class PackageVersionPromoteCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_version_promote');
  public static readonly longDescription = messages.getMessage('cliDescriptionLong', [], 'package_version_promote');
  public static readonly help = messages.getMessage('help', [], 'package_version_promote');
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package', [], 'package_version_promote'),
      longDescription: messages.getMessage('packageLong', [], 'package_version_promote'),
      required: true,
    }),
    noprompt: flags.boolean({
      char: 'n',
      description: messages.getMessage('setasreleasedForce', [], 'package_version_promote'),
      longDescription: messages.getMessage('setasreleasedForceLong', [], 'package_version_promote'),
      required: false,
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();

    const PackageVersionPromoteCommand = require('../../../../lib/package/packageVersionPromoteCommand');
    const packageVersionPromoteCommand = new PackageVersionPromoteCommand();

    return this.execLegacyCommand(packageVersionPromoteCommand, context);
  }
}

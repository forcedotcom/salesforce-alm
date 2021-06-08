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

export class PackageVersionUpdateCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_version_update');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_version_update');
  public static readonly help = messages.getMessage('help', [], 'package_version_update');
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package', [], 'package_version_update'),
      longDescription: messages.getMessage('packageLong', [], 'package_version_update'),
      required: true,
    }),
    versionname: flags.string({
      char: 'a',
      description: messages.getMessage('name', [], 'package_version_update'),
      longDescription: messages.getMessage('nameLong', [], 'package_version_update'),
      required: false,
    }),
    versiondescription: flags.string({
      char: 'e',
      description: messages.getMessage('description', [], 'package_version_update'),
      longDescription: messages.getMessage('descriptionLong', [], 'package_version_update'),
      required: false,
    }),
    branch: flags.string({
      char: 'b',
      description: messages.getMessage('branch', [], 'package_version_update'),
      longDescription: messages.getMessage('branchLong', [], 'package_version_update'),
      required: false,
    }),
    tag: flags.string({
      char: 't',
      description: messages.getMessage('tag', [], 'package_version_update'),
      longDescription: messages.getMessage('tagLong', [], 'package_version_update'),
      required: false,
    }),
    installationkey: flags.string({
      char: 'k',
      description: messages.getMessage('key', [], 'package_version_update'),
      longDescription: messages.getMessage('longKey', [], 'package_version_update'),
      required: false,
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    context.flagsConfig = this.statics.flagsConfig;
    const PackageVersionUpdateCommandImpl = require('../../../../lib/package/packageVersionUpdateCommand');
    const packageVersionUpdateCommand = new PackageVersionUpdateCommandImpl();

    return this.execLegacyCommand(packageVersionUpdateCommand, context);
  }
}

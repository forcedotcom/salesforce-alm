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
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();
import consts = require('../../../../lib/core/constants');

export class PackageVersionDeleteCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_version_delete');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_version_delete');
  public static readonly help = messages.getMessage('help', [], 'package_version_delete');
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    noprompt: flags.boolean({
      char: 'n',
      description: messages.getMessage('noPrompt', [], 'package_version_delete'),
      longDescription: messages.getMessage('noPrompt', [], 'package_version_delete'),
      required: false
    }),
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package', [], 'package_version_delete'),
      longDescription: messages.getMessage('packageLong', [], 'package_version_delete'),
      required: true
    }),
    undelete: flags.boolean({
      description: messages.getMessage('undelete', [], 'package_version_delete'),
      longDescription: messages.getMessage('undeleteLong', [], 'package_version_delete'),
      required: false,
      hidden: true
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    context.flagsConfig = this.statics.flagsConfig;
    const PackageVersionDeleteCommand = require('../../../../lib/package/packageVersionDeleteCommand');
    const heroku = require('heroku-cli-util');
    return this.execLegacyCommand(new PackageVersionDeleteCommand(heroku.prompt), context);
  }
}

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

export class PackageDeleteCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_delete');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_delete');
  public static readonly help = messages.getMessage('help', [], 'package_delete');
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    noprompt: flags.boolean({
      char: 'n',
      description: messages.getMessage('noPrompt', [], 'package_delete'),
      longDescription: messages.getMessage('noPrompt', [], 'package_delete'),
      required: false,
    }),
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package', [], 'package_delete'),
      longDescription: messages.getMessage('packageLong', [], 'package_delete'),
      required: true,
    }),
    undelete: flags.boolean({
      description: messages.getMessage('undelete', [], 'package_delete'),
      longDescription: messages.getMessage('undeleteLong', [], 'package_delete'),
      required: false,
      hidden: true,
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageDeleteCommandImpl = require('../../../lib/package/packageDeleteCommand');
    const heroku = require('heroku-cli-util');
    return this.execLegacyCommand(new PackageDeleteCommandImpl(heroku.prompt), context);
  }
}

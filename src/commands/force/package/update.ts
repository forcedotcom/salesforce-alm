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

export class PackageUpdateCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_update');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_update');
  public static readonly help = messages.getMessage('help', [], 'package_update');
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package', [], 'package_update'),
      longDescription: messages.getMessage('packageLong', [], 'package_update'),
      required: true
    }),
    name: flags.string({
      char: 'n',
      description: messages.getMessage('name', [], 'package_update'),
      longDescription: messages.getMessage('nameLong', [], 'package_update'),
      required: false
    }),
    description: flags.string({
      char: 'd',
      description: messages.getMessage('description', [], 'package_update'),
      longDescription: messages.getMessage('descriptionLong', [], 'package_update'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageUpdateCommand = require('../../../lib/package/packageUpdateCommand');
    return this.execLegacyCommand(new PackageUpdateCommand(), context);
  }
}

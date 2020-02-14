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

export class PackageCreateCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_create');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_create');
  public static readonly help = messages.getMessage('help', [], 'package_create');
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    name: flags.string({
      char: 'n',
      description: messages.getMessage('name', [], 'package_create'),
      longDescription: messages.getMessage('nameLong', [], 'package_create'),
      required: true
    }),
    packagetype: flags.enum({
      char: 't',
      description: messages.getMessage('packageType', [], 'package_create'),
      longDescription: messages.getMessage('packageTypeLong', [], 'package_create'),
      required: true,
      options: ['Managed', 'Unlocked']
    }),
    description: flags.string({
      char: 'd',
      description: messages.getMessage('description', [], 'package_create'),
      longDescription: messages.getMessage('descriptionLong', [], 'package_create'),
      required: false
    }),
    nonamespace: flags.boolean({
      char: 'e',
      description: messages.getMessage('noNamespace', [], 'package_create'),
      longDescription: messages.getMessage('noNamespaceLong', [], 'package_create'),
      required: false
    }),
    path: flags.directory({
      char: 'r',
      description: messages.getMessage('path', [], 'package_version_create'),
      longDescription: messages.getMessage('longPath', [], 'package_version_create'),
      required: true
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageCreateCommand = require('../../../lib/package/packageCreateCommand');
    return this.execLegacyCommand(new PackageCreateCommand(), context);
  }
}

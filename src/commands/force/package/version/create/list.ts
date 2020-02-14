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
import Messages = require('../../../../../lib/messages');
import { ToolbeltCommand } from '../../../../../ToolbeltCommand';

const messages = Messages();
import consts = require('../../../../../lib/core/constants');

export class PackageVersionCreateListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_version_create_list');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_version_create_list');
  public static readonly help = messages.getMessage('help', [], 'package_version_create_list');
  public static readonly requiresProject = false;
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    createdlastdays: flags.number({
      char: 'c',
      description: messages.getMessage('createdLastDaysDescription', [], 'packaging'),
      longDescription: messages.getMessage('createdLastDaysLongDescription', [], 'packaging'),
      required: false
    }),
    status: flags.enum({
      char: 's',
      description: messages.getMessage('statusDescription', [], 'package_version_create_list'),
      longDescription: messages.getMessage('statusLongDescription', [], 'package_version_create_list'),
      required: false,
      options: ['Queued', 'InProgress', 'Success', 'Error']
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageVersionCreateRequestListCommand = require('../../../../../lib/package/packageVersionCreateRequestListCommand');
    return this.execLegacyCommand(new PackageVersionCreateRequestListCommand(), context);
  }
}

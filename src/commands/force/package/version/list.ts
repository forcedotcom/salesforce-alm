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

export class PackageVersionListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_version_list');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_version_list');
  public static readonly help = messages.getMessage('help', [], 'package_version_list');
  public static readonly requiresProject = false;
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    createdlastdays: flags.number({
      char: 'c',
      description: messages.getMessage('createdLastDaysDescription', [], 'packaging'),
      longDescription: messages.getMessage('createdLastDaysLongDescription', [], 'packaging'),
      required: false,
    }),
    concise: flags.builtin({
      description: messages.getMessage('conciseDescription', [], 'package_version_list'),
      longDescription: messages.getMessage('conciseLongDescription', [], 'package_version_list'),
    }),
    modifiedlastdays: flags.number({
      char: 'm',
      description: messages.getMessage('modifiedLastDaysDescription', [], 'packaging'),
      longDescription: messages.getMessage('modifiedLastDaysLongDescription', [], 'packaging'),
      required: false,
    }),
    packages: flags.array({
      char: 'p',
      description: messages.getMessage('packagesDescription', [], 'package_version_list'),
      longDescription: messages.getMessage('packagesLongDescription', [], 'package_version_list'),
      required: false,
    }),
    released: flags.boolean({
      char: 'r',
      description: messages.getMessage('releasedDescription', [], 'package_version_list'),
      longDescription: messages.getMessage('releasedLongDescription', [], 'package_version_list'),
      required: false,
    }),
    orderby: flags.array({
      char: 'o',
      description: messages.getMessage('orderByDescription', [], 'package_version_list'),
      longDescription: messages.getMessage('orderByLongDescription', [], 'package_version_list'),
      required: false,
    }),
    verbose: flags.builtin({
      description: messages.getMessage('verboseDescription', [], 'package_version_list'),
      longDescription: messages.getMessage('verboseLongDescription', [], 'package_version_list'),
    }),
  };
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageVersionListCommandImpl = require('../../../../lib/package/packageVersionListCommand');
    return this.execLegacyCommand(new PackageVersionListCommandImpl(), context);
  }
}

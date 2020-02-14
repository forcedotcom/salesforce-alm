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

export class PackageInstallCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_install');
  public static readonly longDescription = messages.getMessage('cliDescriptionLong', [], 'package_install');
  public static readonly help = messages.getMessage('help', [], 'package_install');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('wait', [], 'package_install'),
      longDescription: messages.getMessage('waitLong', [], 'package_install'),
      required: false
    }),
    installationkey: flags.string({
      char: 'k',
      description: messages.getMessage('installationKey', [], 'package_install'),
      longDescription: messages.getMessage('installationKeyLong', [], 'package_install'),
      required: false
    }),
    publishwait: flags.minutes({
      char: 'b',
      description: messages.getMessage('publishWait', [], 'package_install'),
      longDescription: messages.getMessage('publishWaitLong', [], 'package_install'),
      required: false
    }),
    noprompt: flags.boolean({
      char: 'r',
      description: messages.getMessage('noPrompt', [], 'package_install'),
      longDescription: messages.getMessage('noPromptLong', [], 'package_install'),
      required: false
    }),
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package', [], 'package_install'),
      longDescription: messages.getMessage('packageLong', [], 'package_install'),
      required: false
    }),
    apexcompile: flags.enum({
      char: 'a',
      description: messages.getMessage('apexCompile', [], 'package_install'),
      longDescription: messages.getMessage('apexCompileLong', [], 'package_install'),
      required: false,
      default: 'all',
      options: ['all', 'package']
    }),
    securitytype: flags.enum({
      char: 's',
      description: messages.getMessage('securityType', [], 'package_install'),
      longDescription: messages.getMessage('securityTypeLong', [], 'package_install'),
      required: false,
      default: 'AdminsOnly',
      options: ['AllUsers', 'AdminsOnly']
    }),
    upgradetype: flags.enum({
      char: 't',
      description: messages.getMessage('upgradeType', [], 'package_install'),
      longDescription: messages.getMessage('upgradeTypeLong', [], 'package_install'),
      required: false,
      default: 'Mixed',
      options: ['DeprecateOnly', 'Mixed', 'Delete']
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageInstallCommand = require('../../../lib/package/packageInstallCommand');
    const heroku = require('heroku-cli-util');
    return this.execLegacyCommand(new PackageInstallCommand(heroku.prompt), context);
  }
}

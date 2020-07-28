/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import { Duration } from '@salesforce/kit';
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();
import consts = require('../../../lib/core/constants');

export class PackageConvert extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_convert');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_convert');
  public static readonly help = messages.getMessage('help', [], 'package_convert');
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly requiresProject = false;
  public static readonly hidden = true;
  public static readonly flagsConfig: FlagsConfig = {
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package', [], 'package_convert'),
      longDescription: messages.getMessage('longPackage', [], 'package_convert'),
      required: true
    }),
    installationkey: flags.string({
      char: 'k',
      description: messages.getMessage('key', [], 'package_convert'),
      longDescription: messages.getMessage('longKey', [], 'package_convert'),
      required: false
    }),
    installationkeybypass: flags.boolean({
      char: 'x',
      description: messages.getMessage('keyBypass', [], 'package_convert'),
      longDescription: messages.getMessage('longKeyBypass', [], 'package_convert'),
      required: false
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('wait', [], 'package_convert'),
      longDescription: messages.getMessage('longWait', [], 'package_convert'),
      required: false,
      default: Duration.minutes(0)
    }),
    buildinstance: flags.string({
      char: 's',
      description: messages.getMessage('instance', [], 'package_convert'),
      longDescription: messages.getMessage('longInstance', [], 'package_convert'),
      required: false,
      hidden: true
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageConvertCommandImpl = require('../../../lib/package/packageConvertCommand');
    return this.execLegacyCommand(new PackageConvertCommandImpl(), context);
  }
}

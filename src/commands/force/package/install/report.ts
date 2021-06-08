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

export class PackageInstallReportCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_install_report');
  public static readonly longDescription = messages.getMessage('cliDescriptionLong', [], 'package_install_report');
  public static readonly help = messages.getMessage('help', [], 'package_install_report');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    requestid: flags.id({
      char: 'i',
      description: messages.getMessage('requestId', [], 'package_install_report'),
      longDescription: messages.getMessage('requestIdLong', [], 'package_install_report'),
      required: true,
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageInstallRequestReportCommand = require('../../../../lib/package/PackageInstallRequestReportCommand');
    return this.execLegacyCommand(new PackageInstallRequestReportCommand(), context);
  }
}

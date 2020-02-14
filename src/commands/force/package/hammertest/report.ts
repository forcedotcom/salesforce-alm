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
import { Messages } from '@salesforce/core';
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('salesforce-alm', 'package_hammertest_report');

export class PackageHammertestReportCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription');
  public static readonly longDescription = messages.getMessage('cliLongDescription');
  public static readonly help = messages.getMessage('help');
  public static readonly requiresUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    requestid: flags.id({
      char: 'i',
      description: messages.getMessage('requestid'),
      longDescription: messages.getMessage('requestidLong'),
      required: true
    }),
    summary: flags.boolean({
      char: 's',
      description: messages.getMessage('summary'),
      longDescription: messages.getMessage('summaryLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const HammerTestReportCommand = require('../../../../lib/package/hammerTestReportCommand');
    return this.execLegacyCommand(new HammerTestReportCommand(), context);
  }
}

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
import { Messages } from '@salesforce/core';
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('salesforce-alm', 'package_hammertest_run');

export class PackageHammertestRunCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription');
  public static readonly longDescription = messages.getMessage('cliLongDescription');
  public static readonly help = messages.getMessage('help');
  public static readonly requiresUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    packageversionids: flags.array({
      char: 'i',
      description: messages.getMessage('packageversionids'),
      longDescription: messages.getMessage('packageversionidsLong'),
      required: true
    }),
    subscriberorgs: flags.array({
      char: 's',
      description: messages.getMessage('subscriberorgs'),
      longDescription: messages.getMessage('subscriberorgsLong'),
      required: false
    }),
    subscriberfile: flags.string({
      char: 'f',
      description: messages.getMessage('subscriberfile'),
      longDescription: messages.getMessage('subscriberfileLong'),
      required: false
    }),
    scheduledrundatetime: flags.string({
      char: 'd',
      description: messages.getMessage('scheduledrundatetime'),
      longDescription: messages.getMessage('scheduledrundatetimeLong'),
      required: false
    }),
    preview: flags.boolean({
      char: 'p',
      description: messages.getMessage('preview'),
      longDescription: messages.getMessage('previewLong'),
      required: false
    }),
    apextests: flags.boolean({
      char: 't',
      description: messages.getMessage('apextests'),
      longDescription: messages.getMessage('apextestsLong'),
      required: false
    }),
    apextestinterface: flags.string({
      char: 'n',
      description: messages.getMessage('apextestInterface'),
      longDescription: messages.getMessage('apextestinterfaceLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const HammerTestRunCommand = require('../../../../lib/package/hammerTestRunCommand');
    return this.execLegacyCommand(new HammerTestRunCommand(), context);
  }
}

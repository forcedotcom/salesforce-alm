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
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();

export class Package1VersionCreateCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('package1VersionCreateCommandCliDescription');
  public static readonly longDescription = messages.getMessage('package1VersionCreateCommandCliDescriptionLong');
  public static readonly help = messages.getMessage('package1VersionCreateCommandCliHelp');
  public static readonly requiresUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    packageid: flags.id({
      char: 'i',
      description: messages.getMessage('package1VersionCreateCommandId'),
      longDescription: messages.getMessage('package1VersionCreateCommandIdLong'),
      required: true
    }),
    name: flags.string({
      char: 'n',
      description: messages.getMessage('package1VersionCreateCommandName'),
      longDescription: messages.getMessage('package1VersionCreateCommandNameLong'),
      required: true
    }),
    description: flags.string({
      char: 'd',
      description: messages.getMessage('package1VersionCreateCommandDescription'),
      longDescription: messages.getMessage('package1VersionCreateCommandDescriptionLong'),
      required: false
    }),
    version: flags.string({
      char: 'v',
      description: messages.getMessage('package1VersionCreateCommandVersion'),
      longDescription: messages.getMessage('package1VersionCreateCommandVersionLong'),
      required: false
    }),
    managedreleased: flags.boolean({
      char: 'm',
      description: messages.getMessage('package1VersionCreateCommandManagedReleased'),
      longDescription: messages.getMessage('package1VersionCreateCommandManagedReleasedLong'),
      required: false
    }),
    releasenotesurl: flags.url({
      char: 'r',
      description: messages.getMessage('package1VersionCreateCommandReleaseNotes'),
      longDescription: messages.getMessage('package1VersionCreateCommandReleaseNotesLong'),
      required: false
    }),
    postinstallurl: flags.url({
      char: 'p',
      description: messages.getMessage('package1VersionCreateCommandPostInstall'),
      longDescription: messages.getMessage('package1VersionCreateCommandPostInstallLong'),
      required: false
    }),
    installationkey: flags.string({
      char: 'k',
      description: messages.getMessage('package1VersionCreateCommandInstallationKey'),
      longDescription: messages.getMessage('package1VersionCreateCommandInstallationKeyLong'),
      required: false
    }),
    wait: flags.number({
      char: 'w',
      description: messages.getMessage('package1VersionCreateCommandWait'),
      longDescription: messages.getMessage('package1VersionCreateCommandWaitLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const Package1VersionCreateCommand = require('../../../../lib/package1/package1VersionCreateCommand');
    return this.execLegacyCommand(new Package1VersionCreateCommand(), context);
  }
}

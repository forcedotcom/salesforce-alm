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
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();

export class ProjectUpgradeCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('commandDescription', [], 'projectUpgrade');
  public static readonly longDescription = messages.getMessage('commandDescriptionLong', [], 'projectUpgrade');
  public static readonly help = messages.getMessage('commandHelp', [], 'projectUpgrade');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    forceupgrade: flags.boolean({
      char: 'f',
      description: messages.getMessage('forceOption', [], 'projectUpgrade'),
      longDescription: messages.getMessage('forceOptionLong', [], 'projectUpgrade'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const heroku = require('heroku-cli-util');

    const upgrades = require('../../../lib/project/upgrades');
    return this.execLegacyCommand(
      {
        execute: () => upgrades(heroku.prompt, context.flags.forceupgrade)
      },
      context
    );
  }
}

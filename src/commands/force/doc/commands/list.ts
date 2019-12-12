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
import { sortBy } from '@salesforce/kit';
import { isString } from '@salesforce/ts-types';
import { template } from 'lodash';
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();

export class DocListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('docCommandsListDescription');
  public static readonly longDescription = messages.getMessage('docCommandsListDescriptionLong');
  public static readonly help = messages.getMessage('docCommandsListHelp');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    usage: flags.boolean({
      char: 'u',
      required: false,
      hidden: false,
      description: messages.getMessage('docCommandsListUsageDescription'),
      longDescription: messages.getMessage('docCommandsListUsageDescriptionLong')
    })
  };

  public async run(): Promise<unknown> {
    let commands = this.config.commands;
    commands = commands.filter(c => c.id.indexOf('force:') === 0);
    if (!this.flags.hidden) {
      commands = commands.filter(c => !c.hidden);
    }
    commands = sortBy(commands, 'id');
    const longestCmdName = commands.reduce((acc, curr) => Math.max(acc, curr.id.length), 0);

    this.ux.styledHeader('Commands');

    for (const command of commands) {
      if (this.flags.usage) {
        this.ux.log(`  ${this.getUsageForCommand(command)}`);
      } else {
        const buffer = new Array(longestCmdName - command.id.length + 2).join(' ');
        const description = command.description ? command.description.split('\n')[0] : '';
        this.ux.log(`  ${command.id}${buffer}# ${description}`);
      }
    }
    return commands.map(command => {
      if (this.flags.usage) {
        return this.getUsageForCommand(command);
      }
      return { name: command.id, description: command.description };
    });
  }

  private getUsageForCommand(command) {
    let usage;
    if (isString(command.usage)) {
      usage = command.usage;
    } else if (command.usage) {
      usage = command.usage.join('\n');
    }
    return template(usage)({ command });
  }
}

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

export class SourceStatusCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('statusCommandCliDescription');
  public static readonly longDescription = messages.getMessage('statusCommandCliLongDescription');
  public static readonly help = messages.getMessage('statusCommandCliHelp');
  public static readonly showProgress = true;
  public static readonly requiresProject = true;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    all: flags.boolean({
      char: 'a',
      description: messages.getMessage('statusCommandAllOptionDescription'),
      longDescription: messages.getMessage('statusCommandAllOptionDescriptionLong'),
      required: false
    }),
    local: flags.boolean({
      char: 'l',
      description: messages.getMessage('statusCommandLocalOptionDescription'),
      longDescription: messages.getMessage('statusCommandLocalOptionDescriptionLong'),
      required: false
    }),
    remote: flags.boolean({
      char: 'r',
      description: messages.getMessage('statusCommandRemoteOptionDescription'),
      longDescription: messages.getMessage('statusCommandRemoteOptionDescriptionLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const _ = require('lodash');
    const context = await this.resolveLegacyContext();
    const SrcStatusCommand = require('../../../lib/source/srcStatusCommand');
    if ((_.isNil(context.flags.local) && _.isNil(context.flags.remote)) || context.flags.all) {
      context.local = true;
      context.remote = true;
    } else if (context.flags.local) {
      context.local = true;
    } else if (context.flags.remote) {
      context.remote = true;
    }
    const command = new SrcStatusCommand(context);
    return this.execLegacyCommand(command, context);
  }
}

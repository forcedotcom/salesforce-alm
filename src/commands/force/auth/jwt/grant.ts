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
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();

export class AuthJwtGrantCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'auth_jwt');
  public static readonly longDescription = messages.getMessage('longDescription', [], 'auth_jwt');
  public static readonly help = messages.getMessage('help', [], 'auth_jwt');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    username: flags.string({
      char: 'u',
      description: messages.getMessage('username', [], 'auth_jwt'),
      longDescription: messages.getMessage('usernameLong', [], 'auth_jwt'),
      required: true
    }),
    jwtkeyfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('key', [], 'auth_jwt'),
      longDescription: messages.getMessage('keyLong', [], 'auth_jwt'),
      required: true
    }),
    clientid: flags.string({
      char: 'i',
      description: messages.getMessage('clientId', [], 'auth'),
      longDescription: messages.getMessage('clientIdLong', [], 'auth'),
      required: true
    }),
    instanceurl: flags.url({
      char: 'r',
      description: messages.getMessage('instanceUrl', [], 'auth'),
      longDescription: messages.getMessage('instanceUrlLong', [], 'auth')
    }),
    setdefaultdevhubusername: flags.boolean({
      char: 'd',
      description: messages.getMessage('setDefaultDevHub', [], 'auth'),
      longDescription: messages.getMessage('setDefaultDevHubLong', [], 'auth')
    }),
    setdefaultusername: flags.boolean({
      char: 's',
      description: messages.getMessage('setDefaultUsername', [], 'auth'),
      longDescription: messages.getMessage('setDefaultUsernameLong', [], 'auth')
    }),
    setalias: flags.string({
      char: 'a',
      description: messages.getMessage('setAlias', [], 'auth'),
      longDescription: messages.getMessage('setAliasLong', [], 'auth')
    }),
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('noPrompt', [], 'demoMode'),
      longDescription: messages.getMessage('noPromptLong', [], 'demoMode'),
      required: false,
      hidden: true
    })
  };
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const AuthCommand = require('../../../../lib/auth/authCommand');
    const authCommand = new AuthCommand();
    return this.execLegacyCommand(authCommand, context);
  }
}

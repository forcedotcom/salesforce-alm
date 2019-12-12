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
import consts = require('../../../../lib/core/constants');

export class AuthSfdxurlStoreCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'auth_sfdxurl');
  public static readonly longDescription = messages.getMessage('longDescription', [], 'auth_sfdxurl');
  public static readonly help = messages.getMessage(
    'help',
    [consts.AUTH_URL_FORMAT1, consts.AUTH_URL_FORMAT2],
    'auth_sfdxurl'
  );
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    sfdxurlfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('file', [], 'auth_sfdxurl'),
      longDescription: messages.getMessage('fileLong', [], 'auth_sfdxurl'),
      required: true
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

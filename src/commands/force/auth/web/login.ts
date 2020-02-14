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
import srcDevUtil = require('../../../../lib/core/srcDevUtil');
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

import { SfdxError } from '@salesforce/core';
import * as util from 'util';
const messages = Messages();

export class AuthWebLoginCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'auth_weblogin');
  public static readonly longDescription = messages.getMessage('longDescription', [], 'auth_weblogin');
  public static readonly help = messages.getMessage('help', [], 'auth_weblogin');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    clientid: flags.string({
      char: 'i',
      description: messages.getMessage('clientId', [], 'auth'),
      longDescription: messages.getMessage('clientIdLong', [], 'auth')
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
    disablemasking: flags.boolean({
      description: messages.getMessage('disableMasking', [], 'auth_weblogin'),
      longDescription: messages.getMessage('disableMaskingLong', [], 'auth_weblogin'),
      hidden: true
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
    if (srcDevUtil.isSFDXContainerMode()) {
      throw new SfdxError(messages.getMessage('deviceWarning', [], 'auth'));
    }
    const context = await this.resolveLegacyContext();
    const heroku = require('heroku-cli-util');

    const AuthCommand = require('../../../../lib/auth/authCommand');
    const authCommand = new AuthCommand();
    if (!util.isNullOrUndefined(context.flags.clientid)) {
      return heroku
        .prompt(messages.getMessage('stdin', [], 'auth_weblogin'), {
          mask: !context.flags.disablemasking
        })
        .then(secret => {
          const map = new Map();
          map.set('secret', secret);
          return this.execLegacyCommand(authCommand, context, map);
        });
    } else {
      return this.execLegacyCommand(authCommand, context);
    }
  }
}

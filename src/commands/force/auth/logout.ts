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
import { Global, Mode } from '@salesforce/core';
import logger = require('../../../lib/core/logApi');
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';
import * as _ from 'lodash';

const messages = Messages();

export class AuthLogoutCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'auth_logout');
  public static readonly longDescription = messages.getMessage('longDescription', [], 'auth_logout');
  public static readonly help = messages.getMessage('help', [], 'auth_logout');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = false;
  public static readonly supportsUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    all: flags.boolean({
      char: 'a',
      description: messages.getMessage('all', [], 'auth_logout'),
      longDescription: messages.getMessage('allLong', [], 'auth_logout'),
      required: false
    }),
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('noPrompt', [], 'auth_logout'),
      longDescription: messages.getMessage('noPromptLong', [], 'auth_logout'),
      required: false
    })
  };
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const heroku = require('heroku-cli-util');

    const AuthLogoutCommand = require('../../../lib/auth/authLogoutCommand');
    const authLogoutCommand = new AuthLogoutCommand();

    if (context.flags.targetusername && context.flags.all) {
      const err = new Error(messages.getMessage('specifiedBothUserAndAllError', [], 'auth_logout'));
      err['name'] = 'SpecifiedBothUserAndAllError';
      return Promise.reject(err);
    }

    this.logger = logger.child('auth_logout');

    return authLogoutCommand.getOrgsToLogout(context, this.logger).then(orgsToLogout => {
      context.orgsToLogout = orgsToLogout;
      // don't prompt yes/no if we're forcing the delete request, just execute
      if (context.flags.noprompt || Global.getEnvironmentMode() === Mode.DEMO) {
        return this.execLegacyCommand(authLogoutCommand, context);
      } else {
        return heroku
          .prompt(
            messages.getMessage('logoutCommandYesNo', [authLogoutCommand.getStyledList(orgsToLogout)], 'auth_logout')
          )
          .then(answer => {
            if (answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y') {
              return this.execLegacyCommand(authLogoutCommand, context);
            }
            return undefined;
          });
      }
    });
  }
}

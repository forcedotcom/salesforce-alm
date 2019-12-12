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

import * as fs from 'fs';
const messages = Messages();

export class OrgListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'org_list');
  public static readonly longDescription = messages.getMessage('longDescription', [], 'org_list');
  public static readonly help = messages.getMessage('help', [], 'org_list');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    verbose: flags.builtin({
      description: messages.getMessage('verbose', [], 'org_list'),
      longDescription: messages.getMessage('verboseLong', [], 'org_list')
    }),
    all: flags.boolean({
      description: messages.getMessage('all', [], 'org_list'),
      longDescription: messages.getMessage('allLong', [], 'org_list'),
      required: false
    }),
    clean: flags.boolean({
      description: messages.getMessage('clean', [], 'org_list'),
      longDescription: messages.getMessage('cleanLong', [], 'org_list'),
      required: false
    }),
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('noPrompt', [], 'org_list'),
      longDescription: messages.getMessage('noPromptLong', [], 'org_list'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const heroku = require('heroku-cli-util');
    const BBPromise = require('bluebird');
    BBPromise.promisifyAll(fs);

    const OrgListCommand = require('../../../lib/org/orgListCommand');

    return this.execLegacyCommand(new OrgListCommand(heroku.prompt), context);
  }
}

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

export class OrgShapeDeleteCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'org_shape_delete');
  public static readonly longDescription = messages.getMessage('longDescription', [], 'org_shape_delete');
  public static readonly help = messages.getMessage('help', [], 'org_shape_delete');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('noPrompt', [], 'org_shape_delete'),
      longDescription: messages.getMessage('noPromptLong', [], 'org_shape_delete'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const heroku = require('heroku-cli-util');

    const OrgShapeDeleteCommand = require('../../../../lib/org/orgShapeDeleteCommand');
    const orgShapeDeleteCommand = new OrgShapeDeleteCommand();

    // don't prompt yes/no if we're forcing the delete request, just execute
    if (context.flags.noprompt) {
      return this.execLegacyCommand(orgShapeDeleteCommand, context);
    } else {
      return heroku
        .prompt(messages.getMessage('deleteCommandYesNo', this.org.getUsername(), 'org_shape_delete'))
        .then(answer => {
          if (answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y') {
            return this.execLegacyCommand(orgShapeDeleteCommand, context);
          }
          return undefined;
        });
    }
  }
}

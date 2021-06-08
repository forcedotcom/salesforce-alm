/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();
const commandTimeOutInMS = 30e3;

export class OrgShapeCreateCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('create_shape_command_description', null, 'org_shape');
  public static readonly longDescription = messages.getMessage(
    'create_shape_command_description_long',
    null,
    'org_shape'
  );
  public static readonly help = messages.getMessage('create_shape_command_help', null, 'org_shape');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const ShapeRepCreateCommandImpl = require('../../../../lib/org/shapeRepCreateCommand');
    const createCommand = new ShapeRepCreateCommandImpl();

    let timeoutID;

    const timeout = new Promise((_, reject) => {
      timeoutID = setTimeout(() => {
        reject(messages.getMessage('shapeCreateFailedMessage'));
      }, commandTimeOutInMS);
    });

    return Promise.race([this.execLegacyCommand(createCommand, context), timeout]).then((result) => {
      clearTimeout(timeoutID);
      return result;
    });
  }
}

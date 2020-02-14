/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const { getMessage } = messages();

export class UserListCommand extends ToolbeltCommand {
  public static readonly theDescription = getMessage('description', [], 'user_list');
  public static readonly longDescription = getMessage('longDescription', [], 'user_list');
  public static readonly help = getMessage('help', [], 'user_list');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly supportsDevhubUsername = true;

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { UserListCommand } = require('../../../lib/user/userListCommand');
    return await this.execLegacyCommand(new UserListCommand(), context);
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import * as Messages from '../../../../lib/force-cli/force-cli-messages';
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

export class ApexLogListCommand extends ToolbeltCommand {
  public static readonly theDescription = Messages.get('ApexLogListDescription');
  public static readonly longDescription = Messages.get('ApexLogListLongDescription');
  public static readonly help = Messages.get('ApexLogListHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const { ApexLogListCommand } = require('../../../../lib/apex/apexLogListCommand');
    return this.execLegacyCommand(new ApexLogListCommand(), context);
  }
}

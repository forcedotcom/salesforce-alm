/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();
import consts = require('../../../../lib/core/constants');

export class OrgSnapshotListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('listSnapshotCmdDescription', [], 'orgSnapshot');
  public static readonly longDescription = messages.getMessage('listSnapshotCmdDescriptionLong', [], 'orgSnapshot');
  public static readonly help = messages.getMessage('listSnapshotCmdHelp', [], 'orgSnapshot');
  public static readonly showProgress = true;
  public static readonly requiresProject = false;
  public static readonly requiresDevhubUsername = true;
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const OrgSnapshotListCommand = require('../../../../lib/org/snapshot/orgSnapshotListCommand'); // eslint-disable-line global-require
    return this.execLegacyCommand(new OrgSnapshotListCommand(), context);
  }
}

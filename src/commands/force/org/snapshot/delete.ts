/*
 * Copyright (c) 2020, salesforce.com, inc.
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

export class OrgSnapshotDeleteCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('deleteSnapshotCmdDescription', [], 'orgSnapshot');
  public static readonly longDescription = messages.getMessage('deleteSnapshotCmdDescriptionLong', [], 'orgSnapshot');
  public static readonly help = messages.getMessage('deleteSnapshotCmdHelp', [], 'orgSnapshot');
  public static readonly showProgress = true;
  public static readonly requiresProject = false;
  public static readonly requiresDevhubUsername = true;
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly flagsConfig: FlagsConfig = {
    snapshot: flags.string({
      char: 's',
      description: messages.getMessage('deleteSnapshotCmdSnapshotDescription', [], 'orgSnapshot'),
      longDescription: messages.getMessage('deleteSnapshotCmdSnapshotDescriptionLong', [], 'orgSnapshot'),
      required: true,
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const OrgSnapshotDeleteCommandImpl = require('../../../../lib/org/snapshot/orgSnapshotDeleteCommand'); // eslint-disable-line global-require
    return this.execLegacyCommand(new OrgSnapshotDeleteCommandImpl(), context);
  }
}

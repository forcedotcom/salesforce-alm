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
import consts = require('../../../../lib/core/constants');

export class OrgSnapshotCreateCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('createSnapshotCmdDescription', [], 'orgSnapshot');
  public static readonly longDescription = messages.getMessage('createSnapshotCmdDescriptionLong', [], 'orgSnapshot');
  public static readonly help = messages.getMessage('createSnapshotCmdHelp', [], 'orgSnapshot');
  public static readonly showProgress = true;
  public static readonly requiresProject = false;
  public static readonly requiresDevhubUsername = true;
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly flagsConfig: FlagsConfig = {
    sourceorg: flags.string({
      char: 'o',
      description: messages.getMessage('createSnapshotCmdSourceOrgDescription', [], 'orgSnapshot'),
      longDescription: messages.getMessage('createSnapshotCmdSourceOrgDescriptionLong', [], 'orgSnapshot'),
      required: true
    }),
    snapshotname: flags.string({
      char: 'n',
      description: messages.getMessage('createSnapshotCmdNameDescription', [], 'orgSnapshot'),
      longDescription: messages.getMessage('createSnapshotCmdNameDescriptionLong', [], 'orgSnapshot'),
      required: true
    }),
    description: flags.string({
      char: 'd',
      description: messages.getMessage('createSnapshotCmdDescriptionDescription', [], 'orgSnapshot'),
      longDescription: messages.getMessage('createSnapshotCmdDescriptionDescriptionLong', [], 'orgSnapshot'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const OrgSnapshotCreateCommand = require('../../../../lib/org/snapshot/orgSnapshotCreateCommand'); // eslint-disable-line global-require
    return this.execLegacyCommand(new OrgSnapshotCreateCommand(), context);
  }
}

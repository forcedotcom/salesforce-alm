/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { isNumber } from '@salesforce/ts-types';
import chalk from 'chalk';
import { MaxRevision } from '../../../../lib/source/MaxRevision';
import { SourcePathStatusManager } from '../../../../lib/source/sourcePathStatusManager';
import { WorkspaceFileState } from '../../../../lib/source/workspace';

const Org = require('../../../../lib/core/scratchOrgApi');

Messages.importMessagesDirectory(__dirname);

const messages: Messages = Messages.loadMessages('salesforce-alm', 'source_tracking');

export type SourceTrackingResetResult = {
  sourceMembersSynced: number;
  localPathsSynced: number;
};

export class SourceTrackingResetCommand extends SfdxCommand {
  public static readonly description = messages.getMessage('resetDescription');
  public static readonly longDescription = messages.getMessage('resetLongDescription');

  public static readonly requiresProject = true;
  public static readonly requiresUsername = true;

  public static readonly flagsConfig: FlagsConfig = {
    revision: flags.integer({
      char: 'r',
      description: messages.getMessage('revisionDescription'),
      longDescription: messages.getMessage('revisionLongDescription'),
      required: false,
      min: 0
    }),
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('nopromptDescription'),
      longDescription: messages.getMessage('nopromptLongDescription'),
      required: false
    })
  };
  public async run(): Promise<SourceTrackingResetResult> {
    if (!this.flags.noprompt) {
      const answer = await this.ux.prompt(chalk.dim(messages.getMessage('promptMessage')));
      if (answer.toLowerCase() !== 'y') {
        // Nothing synced because it was canceled.
        return {
          sourceMembersSynced: 0,
          localPathsSynced: 0
        };
      }
    }

    // TODO Remove legacy org from source path status manager and workspace.
    const legacyOrg = new Org();
    const username = this.org.getUsername();
    legacyOrg.setName(username);

    // Retrieve and update server members locally
    const revision = await MaxRevision.getInstance({ username });
    const members = await revision.queryAllSourceMembers();
    await revision.updateSourceTracking(members);

    const desiredRevision = this.flags.revision;
    if (isNumber(desiredRevision)) {
      Object.values(revision.getContents().sourceMembers).forEach(member => {
        if (member.lastRetrievedFromServer > desiredRevision) {
          member.lastRetrievedFromServer = null; // Say we don't have it
        }
      });
      await revision.write();
    }

    // // Reset sourcePathInfos locally
    const manager = await SourcePathStatusManager.create({ org: legacyOrg });
    const workspace = manager.workspace;
    await workspace.walkDirectories(workspace.trackedPackages);

    const workspaceElements = workspace.entries();
    workspaceElements.forEach(([_, pathInfo]) => (pathInfo.state = WorkspaceFileState.UNCHANGED));
    await workspace.write();

    this.ux.log(`Reset local tracking files${desiredRevision ? ` to revision ${desiredRevision}` : ''}.`);

    return {
      sourceMembersSynced: members.length,
      localPathsSynced: workspaceElements.length
    };
  }
}

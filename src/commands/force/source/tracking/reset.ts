/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import chalk from 'chalk';
import { RemoteSourceTrackingService } from '../../../../lib/source/remoteSourceTrackingService';
import { SourcePathStatusManager } from '../../../../lib/source/sourcePathStatusManager';
import { WorkspaceFileState } from '../../../../lib/source/workspaceFileState';

const Org = require('../../../../lib/core/scratchOrgApi');

Messages.importMessagesDirectory(__dirname);

const messages: Messages = Messages.loadMessages('salesforce-alm', 'source_tracking');

export type SourceTrackingResetResult = {
  sourceMembersSynced: number;
  localPathsSynced: number;
};

export class SourceTrackingResetCommand extends SfdxCommand {
  public static readonly description = messages.getMessage('resetDescription');

  public static readonly requiresProject = true;
  public static readonly requiresUsername = true;

  public static readonly flagsConfig: FlagsConfig = {
    revision: flags.integer({
      char: 'r',
      description: messages.getMessage('revisionDescription'),
      required: false,
      min: 0,
    }),
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('nopromptDescription'),
      required: false,
    }),
  };
  public async run(): Promise<SourceTrackingResetResult> {
    if (!this.flags.noprompt) {
      const answer = await this.ux.prompt(chalk.dim(messages.getMessage('promptMessage')));
      if (answer.toLowerCase() !== 'y') {
        // Nothing synced because it was canceled.
        return {
          sourceMembersSynced: 0,
          localPathsSynced: 0,
        };
      }
    }

    // TODO Remove legacy org from source path status manager and workspace.
    const legacyOrg = new Org();
    const username = this.org.getUsername();
    legacyOrg.setName(username);

    // Retrieve and update server members locally
    const revision = await RemoteSourceTrackingService.getInstance({ username });
    const desiredRevision = this.flags.revision;
    await revision.reset(desiredRevision);

    // Reset sourcePathInfos locally
    const manager = await SourcePathStatusManager.create({ org: legacyOrg });
    const workspace = manager.workspace;
    await workspace.walkDirectories(workspace.trackedPackages);

    const workspaceElements = workspace.entries();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    workspaceElements.forEach(([_, pathInfo]) => (pathInfo.state = WorkspaceFileState.UNCHANGED));
    await workspace.write();

    this.ux.log(`Reset local tracking files${desiredRevision ? ` to revision ${desiredRevision}` : ''}.`);

    return {
      sourceMembersSynced: revision.getTrackedElements().length,
      localPathsSynced: workspaceElements.length,
    };
  }
}

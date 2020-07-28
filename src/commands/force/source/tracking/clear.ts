/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { ConfigContents, Messages } from '@salesforce/core';
import chalk from 'chalk';
import { MaxRevision } from '../../../../lib/source/MaxRevision';
import { Workspace } from '../../../../lib/source/workspace';

const Org = require('../../../../lib/core/scratchOrgApi');

Messages.importMessagesDirectory(__dirname);

const messages: Messages = Messages.loadMessages('salesforce-alm', 'source_tracking');

export type SourceTrackingClearResult = {
  clearedFiles: string[];
};

// ConfigFile reads the file on init. We don't want to read the file, just delete it.
class OnlyDeletableMaxRevision extends MaxRevision {
  public async read(throwOnNotFound?: boolean, force?: boolean): Promise<ConfigContents> {
    return {};
  }
  public async write(newContents?: ConfigContents): Promise<ConfigContents> {
    return {};
  }
}

// ConfigFile reads the file on init. We don't want to read the file, just delete it.
class OnlyDeletableWorkspace extends Workspace {
  public async read(throwOnNotFound?: boolean, force?: boolean): Promise<ConfigContents> {
    return {};
  }
  public async write(newContents?: ConfigContents): Promise<ConfigContents> {
    return {};
  }
}

export class SourceTrackingClearCommand extends SfdxCommand {
  public static readonly description = messages.getMessage('clearDescription');
  public static readonly longDescription = messages.getMessage('clearLongDescription');

  public static readonly requiresProject = true;
  public static readonly requiresUsername = true;

  public static readonly flagsConfig: FlagsConfig = {
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('nopromptDescription'),
      longDescription: messages.getMessage('nopromptLongDescription'),
      required: false
    })
  };
  public async run(): Promise<SourceTrackingClearResult> {
    const clearedFiles = [];

    if (!this.flags.noprompt) {
      const answer = await this.ux.prompt(chalk.dim(messages.getMessage('promptMessage')));
      if (answer.toLowerCase() !== 'y') {
        // Nothing cleared because it was canceled.
        return { clearedFiles };
      }
    }

    // TODO Remove legacy org from source path status manager and workspace.
    const legacyOrg = new Org();
    const username = this.org.getUsername();
    legacyOrg.setName(username);

    const revision = await OnlyDeletableMaxRevision.create({ username });
    try {
      await revision.unlink();
      clearedFiles.push(revision.getPath());
    } catch (e) {}

    // // Reset sourcePathInfos locally
    const workspace = await OnlyDeletableWorkspace.create({
      org: legacyOrg,
      forceIgnore: null,
      isStateless: true
    });
    try {
      await workspace.unlink();
      clearedFiles.push(workspace.getPath());
    } catch (e) {}

    this.ux.log('Cleared local tracking files.');

    return { clearedFiles };
  }
}

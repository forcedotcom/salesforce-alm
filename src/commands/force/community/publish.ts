/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { CommunityPublishResource } from '../../../lib/community/connect/CommunityPublishResource';
import { ConnectExecutor } from '../../../lib/connect/services/ConnectExecutor';
import { CommunityPublishResponse } from '../../../lib/community/defs/CommunityPublishResponse';

Messages.importMessagesDirectory(__dirname);
const community = Messages.loadMessages('salesforce-alm', 'community_commands');

/**
 * A command to publish a community. This is just an sfdx wrapper around
 * the community publish connect endpoint
 */
export class CommunityPublishCommand extends SfdxCommand {
  public static readonly requiresUsername = true;
  public static readonly help = community.getMessage('publish.help');
  public static readonly longDescription = community.getMessage('publish.longDescription');
  public static readonly description =
    community.getMessage('publish.description') + '\n\n' + CommunityPublishCommand.help;
  public static readonly flagsConfig: FlagsConfig = {
    name: flags.string({
      char: 'n',
      description: community.getMessage('publish.flags.name.description'),
      longDescription: community.getMessage('publish.flags.name.longDescription'),
      required: true,
    }),
  };

  public async run(): Promise<CommunityPublishResponse | Error> {
    const publishCommand = new CommunityPublishResource(this.flags, this.org, this.ux);
    return new ConnectExecutor(publishCommand, this.org).callConnectApi();
  }
}

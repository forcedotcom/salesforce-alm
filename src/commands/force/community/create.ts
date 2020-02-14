/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { ConnectExecutor } from '../../../lib/connect/services/ConnectExecutor';
import { CommunityCreateResource } from '../../../lib/community/connect/CommunityCreateResource';
import { CommunityCreateResponse } from '../../../lib/community/defs/CommunityCreateResponse';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const communityMessages = Messages.loadMessages('salesforce-alm', 'community_commands');
/**
 * A command to create a community.
 * This is just an sfdx wrapper around the community create connect endpoint
 */
export class CommunityCreateCommand extends SfdxCommand {
  public static readonly requiresUsername = true;
  public static readonly help = communityMessages.getMessage('create.help');
  public static readonly longDescription = communityMessages.getMessage('create.longDescription');
  public static readonly description =
    communityMessages.getMessage('create.description') + '\n\n' + CommunityCreateCommand.help;
  public static readonly flagsConfig: FlagsConfig = {
    name: flags.string({
      char: 'n',
      description: communityMessages.getMessage('create.flags.name.description'),
      longDescription: communityMessages.getMessage('create.flags.name.longDescription'),
      required: true
    }),
    templatename: flags.string({
      char: 't',
      description: communityMessages.getMessage('create.flags.templateName.description'),
      longDescription: communityMessages.getMessage('create.flags.templateName.longDescription'),
      required: true
    }),
    urlpathprefix: flags.string({
      char: 'p',
      description: communityMessages.getMessage('create.flags.urlPathPrefix.description'),
      longDescription: communityMessages.getMessage('create.flags.urlPathPrefix.longDescription'),
      required: true
    }),
    description: flags.string({
      char: 'd',
      description: communityMessages.getMessage('create.flags.description.description'),
      longDescription: communityMessages.getMessage('create.flags.description.longDescription'),
      required: false
    })
  };

  public async run(): Promise<CommunityCreateResponse | Error> {
    const createCommand = new CommunityCreateResource(this.flags, this.ux);
    return new ConnectExecutor(createCommand, this.org).callConnectApi();
  }
}

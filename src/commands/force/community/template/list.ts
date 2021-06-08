/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { CommunityTemplatesResource } from '../../../../lib/community/connect/CommunityTemplatesResource';
import { ConnectExecutor } from '../../../../lib/connect/services/ConnectExecutor';
import { CommunityTemplatesListResponse } from '../../../../lib/community/defs/CommunityTemplatesListResponse';

Messages.importMessagesDirectory(__dirname);
const community = Messages.loadMessages('salesforce-alm', 'community_commands');

/**
 * A command to fetch available community templates a community. This is just an sfdx wrapper around
 * the get available community templates connect endpoint
 */
export class CommunityListTemplatesCommand extends SfdxCommand {
  public static readonly requiresUsername = true;
  public static readonly help = community.getMessage('list.help');
  public static readonly description =
    community.getMessage('list.description') + '\n\n' + CommunityListTemplatesCommand.help;
  public static readonly longDescription = community.getMessage('list.longDescription');

  public async run(): Promise<CommunityTemplatesListResponse | Error> {
    const listTemplateCommand = new CommunityTemplatesResource(this.ux);
    return new ConnectExecutor(listTemplateCommand, this.org).callConnectApi();
  }
}

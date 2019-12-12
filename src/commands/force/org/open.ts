/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { isSFDXContainerMode } from '../../../lib/core/srcDevUtil';
import Messages = require('../../../lib/messages');
import open from '../../../lib/org/open';

const messages = Messages();

export class OrgOpenCommand extends SfdxCommand {
  public static readonly description = `${messages.getMessage('openCommandCliDescription')}\n${messages.getMessage(
    'openCommandCliHelp'
  )}`;
  public static readonly longDescription = messages.getMessage('openCommandCliDescriptionLong');
  // TODO ask ruth about this. Keep help for legacy doc creation
  public static readonly help = messages.getMessage('openCommandCliHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    path: flags.string({
      char: 'p',
      description: messages.getMessage('openCommandCliPath'),
      longDescription: messages.getMessage('openCommandCliPathLong'),
      required: false
    }),
    urlonly: flags.boolean({
      char: 'r',
      description: messages.getMessage('openCommandUrlonly'),
      longDescription: messages.getMessage('openCommandUrlonlyLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    // The old org:open didn't have a "setup" flag but had it in the code to go to
    // the setup page. I'm not sure if it was ever there or removed on purpose, but
    // kept the code path just in case.
    const path = this.flags.path;
    const urlOnly = this.flags.urlonly;
    const { orgId, url, username } = await open.open(this.org, this.ux, path, false, urlOnly);
    if (isSFDXContainerMode()) {
      // instruct the user that they need to paste the URL into the browser
      this.ux.styledHeader(messages.getMessage('actionRequiredHeader'));
      this.ux.log(messages.getMessage('openCommandContainerAction', [orgId, url]));
    } else {
      this.ux.log(messages.getMessage('openCommandHumanSuccess', [orgId, username, url]));
    }
    return { orgId, url, username };
  }
}

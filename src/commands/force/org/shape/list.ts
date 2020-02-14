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
import * as BBPromise from 'bluebird';
import * as fs from 'fs';
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();

export class OrgShapeListCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'org_shape_list');
  public static readonly longDescription = messages.getMessage('longDescription', [], 'org_shape_list');
  public static readonly help = messages.getMessage('help', [], 'org_shape_list');
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    verbose: flags.builtin({
      description: messages.getMessage('verbose', [], 'org_shape_list'),
      longDescription: messages.getMessage('verboseLong', [], 'org_shape_list')
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();

    BBPromise.promisifyAll(fs);

    const OrgShapeListCommand = require('../../../../lib/org/orgShapeListCommand'); // eslint-disable-line global-require
    return this.execLegacyCommand(new OrgShapeListCommand(), context);
  }
}

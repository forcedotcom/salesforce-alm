/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import Alias = require('../../../lib/core/alias');
import logger = require('../../../lib/core/logApi');
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();

export class AliasSetCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', [], 'aliasSetCommand');
  public static readonly longDescription = messages.getMessage('longDescription', [], 'aliasSetCommand');
  public static readonly help = messages.getMessage('help', [], 'aliasSetCommand');
  public static readonly requiresProject = false;
  public static readonly varargs = { required: true };
  public async run(): Promise<unknown> {
    const _ = require('lodash');
    const context = await this.resolveLegacyContext();
    return this.execLegacyCommand(
      {
        execute: execContext =>
          Alias.parseAndSet(execContext.args, execContext.flags.group).then(savedAliases => {
            logger.styledHeader(logger.color.blue('Alias Set'));
            return _.map(savedAliases, (value, alias) => ({ alias, value }));
          }),
        getColumnData: () => [
          { key: 'alias', label: 'Alias' },
          { key: 'value', label: 'Value' }
        ]
      },
      context
    );
  }
}

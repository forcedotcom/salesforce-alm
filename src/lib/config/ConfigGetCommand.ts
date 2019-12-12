/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import * as almError from '../core/almError';
import logger = require('../core/logApi');
import Messages = require('../messages');
const messages = Messages();
import { ConfigAggregator } from '@salesforce/core';

class GetCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('config:get');
  }

  async validate(context) {
    if (context.args.length === 0) {
      throw almError({ keyName: 'NoConfigKeysFound', bundle: 'configGetCommand' }, []);
    }

    return context;
  }

  async execute(context) {
    if (context.args.length === 0) {
      throw almError({ keyName: 'NoConfigKeysFound', bundle: 'configGetCommand' }, []);
    }

    this.flags = context.flags;

    const results = [];
    const aggregator = await ConfigAggregator.create();
    context.args.forEach(configName => {
      results.push(aggregator.getInfo(configName));
    });

    return results;
  }

  getColumnData() {
    this.logger.styledHeader(this.logger.color.blue('Config'));
    const columns = [
      {
        key: 'key',
        label: messages.getMessage('key', [], 'configListCommand')
      },
      {
        key: 'value',
        label: messages.getMessage('value', [], 'configListCommand')
      }
    ];
    if (this.flags.verbose) {
      columns.push({
        key: 'location',
        label: messages.getMessage('location', [], 'configListCommand')
      });
    }
    return columns;
  }
}

export = GetCommand;

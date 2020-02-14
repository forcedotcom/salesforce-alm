/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator } from '@salesforce/core';
import Messages = require('../messages');
const messages = Messages();
import logger = require('../core/logApi');

class ListCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('config:list');
  }

  validate() {
    return Promise.resolve();
  }

  async execute() {
    this.aggregator = await ConfigAggregator.create();

    return this.aggregator.getConfigInfo().map(c => {
      delete c.path;
      return c;
    });
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
    columns.push({
      key: 'location',
      label: messages.getMessage('location', [], 'configListCommand')
    });
    return columns;
  }
}

export = ListCommand;

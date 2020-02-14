/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Config from '../force-cli/force-cli-config';
import * as Error from '../force-cli/force-cli-error';
import * as Display from '../force-cli/force-cli-display';
import logApi = require('../core/logApi');
import { Connection } from 'jsforce';
import util = require('util');

let logger;

export class ApiLimitsCommand {
  constructor() {
    logger = logApi.child('limits:api:display');
  }

  validate(context) {}

  async execute(context, doneCallback?: (...args) => any): Promise<any> {
    try {
      let conn: Connection = await Config.getActiveConnection(context);
      let geturl: string = util.format('%s/services/data/v%s/limits', conn.instanceUrl, conn.version);
      let limits: ApiLimit[];
      await conn.request(geturl, function(err: Error, response): void {
        if (err) {
          logger.error(err);
          Error.exitWithMessage(err.message);
        }
        limits = parseResponse(response);
        Display.apiLimits(limits);
      });
      return limits;
    } catch (err) {
      logger.error(err);
      Error.exitWithMessage(err.message);
    }
  }
}

/**
 * constructs ApiLimit objects from server response
 * exposed for unit testing
 * @param {Object} response
 * @returns {ApiLimit[]}
 */
export let parseResponse = function(response): ApiLimit[] {
  let limits: ApiLimit[] = [];
  for (let limitName in response) {
    if (response.hasOwnProperty(limitName)) {
      limits.push({
        name: limitName,
        max: response[limitName]['Max'],
        remaining: response[limitName]['Remaining']
      });
    }
  }
  return limits;
};

export interface ApiLimit {
  name: string;
  max: number;
  remaining: number;
}

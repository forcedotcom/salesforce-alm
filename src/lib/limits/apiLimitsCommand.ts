/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Config from '../force-cli/force-cli-config';
import * as Display from '../force-cli/force-cli-display';
import { Connection } from 'jsforce';
import util = require('util');
import { SfdxError } from '@salesforce/core';

export class ApiLimitsCommand {
  async execute(context): Promise<ApiLimit[]> {
    try {
      let conn: Connection = await Config.getActiveConnection(context);
      let geturl: string = util.format('%s/services/data/v%s/limits', conn.instanceUrl, conn.version);
      const result = await conn.request(geturl);

      const limits: ApiLimit[] = parseResponse(result);
      Display.apiLimits(limits);
      return limits;
    } catch (err) {
      throw SfdxError.wrap(err);
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

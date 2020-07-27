/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as HttpApi from 'jsforce/lib/http-api';

export let request = HttpApi.prototype.request;

export const requestPerfMetrics = [];

export function getPerfMetricsFromResponse(response) {
  let metrics = response.headers['perfmetrics'];
  /* istanbul ignore else */
  if (metrics) {
    let perfMetrics = {
      requestPath: response.req.path,
      perfMetrics: JSON.parse(metrics)
    };
    requestPerfMetrics.push(perfMetrics);
  }
}

HttpApi.prototype.request = function(req, ...args) {
  this.once('response', getPerfMetricsFromResponse);
  return request.call(this, req, ...args);
};

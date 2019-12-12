/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 * This module hooks into HttpApi request to get perfMetrics from the response header then returns the original request back.
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
  this.on('response', getPerfMetricsFromResponse);
  return request.call(this, req, ...args);
};

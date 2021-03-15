/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const SOAP_FAULTSTRING_KEY = 'faultstring';

export let hasFaultString = function(errMsg: string): boolean {
  return errMsg ? errMsg.indexOf(SOAP_FAULTSTRING_KEY) > -1 : false;
};

export let getFaultString = function(errMsg: string): string {
  return errMsg.split('<faultstring>')[1].split('</faultstring>')[0];
};

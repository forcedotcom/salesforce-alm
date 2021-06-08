/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const SOAP_FAULTSTRING_KEY = 'faultstring';

export const hasFaultString = function (errMsg: string): boolean {
  return errMsg ? errMsg.indexOf(SOAP_FAULTSTRING_KEY) > -1 : false;
};

export const getFaultString = function (errMsg: string): string {
  return errMsg.split('<faultstring>')[1].split('</faultstring>')[0];
};

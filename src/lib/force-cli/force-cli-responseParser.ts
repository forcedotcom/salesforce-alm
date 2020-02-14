/// <reference path="../../../node_modules/@types/xml2js/index.d.ts" />

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Error from './force-cli-error';
import * as Messages from './force-cli-messages';

const SOAP_ENVELOPE_KEY = 'soapenv:Envelope';
const SOAP_BODY_KEY = 'soapenv:Body';
const SOAP_HEADER_KEY = 'soapenv:Header';

const SOAP_FAULTSTRING_KEY = 'faultstring';

const RESULT_KEY = 'result';
const EXEC_SUCCESS_KEY = 'success';

const EXEC_RESPONSE_KEY = 'executeAnonymousResponse';
const EXEC_DEBUGGINGINFO_KEY = 'DebuggingInfo';
const EXEC_DEBUGLOG_KEY = 'debugLog';
const EXEC_COMPILEPROBLEM_KEY = 'compileProblem';
const EXEC_COMPILED_KEY = 'compiled';
const EXEC_LINE_KEY = 'line';
const EXEC_COLUMN_KEY = 'column';
const EXEC_EXCEPTIONMESSAGE_KEY = 'exceptionMessage';
const EXEC_EXCEPTIONSTACKTRACE_KEY = 'exceptionStackTrace';

interface ExecuteAnonymousResult {
  compiled: boolean;
  compileProblem: string;
  success: boolean;
  line: number;
  column: number;
  exceptionMessage: string;
  exceptionStackTrace: string;
}

/**
 * @param xml {any} - Could be passed an error message string or a no error object
 * @returns {string} - Returns an empty string if passed an error object to indicate no error message
 * Otherwise returns the error message
 */
let xmlErrorMessageToString = function(xml: any): string {
  if (typeof xml === 'object' && xml['$']['xsi:nil']) {
    return '';
  } else if (typeof xml === 'string') {
    return xml;
  } else {
    return '';
  }
};

export let hasFaultString = function(errMsg: string): boolean {
  return errMsg ? errMsg.indexOf(SOAP_FAULTSTRING_KEY) > -1 : false;
};

export let getFaultString = function(errMsg: string): string {
  return errMsg.split('<faultstring>')[1].split('</faultstring>')[0];
};

/**
 * extracts the debug info header from the execute anonymous apex code request
 * @param {Object} responseBody - xml response to an executeAnonymous request
 * @return {string} the compiler's debug info
 */
export let getDebugInfo = function(response: Object): string {
  let debugInfo = '';
  try {
    debugInfo = response[SOAP_ENVELOPE_KEY][SOAP_HEADER_KEY][EXEC_DEBUGGINGINFO_KEY][EXEC_DEBUGLOG_KEY];
  } catch (err) {
    Error.exitWithMessage(Messages.get('ResponseParserDebugError', JSON.stringify(response)));
  }
  return debugInfo;
};

export let getExecuteAnonymousResponse = function(response: Object): ExecuteAnonymousResult {
  let result: ExecuteAnonymousResult = <ExecuteAnonymousResult>{};
  try {
    let execResponse = response[SOAP_ENVELOPE_KEY][SOAP_BODY_KEY][EXEC_RESPONSE_KEY][RESULT_KEY];
    result = {
      compiled: execResponse[EXEC_COMPILED_KEY] === 'true',
      compileProblem: xmlErrorMessageToString(execResponse[EXEC_COMPILEPROBLEM_KEY]),
      success: execResponse[EXEC_SUCCESS_KEY] === 'true',
      line: Number(execResponse[EXEC_LINE_KEY]),
      column: Number(execResponse[EXEC_COLUMN_KEY]),
      exceptionMessage: xmlErrorMessageToString(execResponse[EXEC_EXCEPTIONMESSAGE_KEY]),
      exceptionStackTrace: xmlErrorMessageToString(execResponse[EXEC_EXCEPTIONSTACKTRACE_KEY])
    };
  } catch (err) {
    Error.exitWithMessage(Messages.get('ResponseParserStatusError', JSON.stringify(response)));
  }
  return result;
};

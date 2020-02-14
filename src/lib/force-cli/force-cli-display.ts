/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Messages from './force-cli-messages';
import logApi = require('../core/logApi');
import { DebugLog } from '../apex/apexLogApi';
import { ApiLimit } from '../limits/apiLimitsCommand';
import { BatchInfo } from 'jsforce';
import { BatchResultInfo } from 'jsforce';
import { JobInfo } from 'jsforce';

import readline = require('readline-sync');

export let success = function(msg: string): void {
  logApi.log(logApi.color.green(msg));
};

export let failure = function(msg: string): void {
  logApi.error(logApi.color.red(msg));
};

export let info = function(msg: string): void {
  logApi.log(msg);
};

export let warning = function(msg: string): void {
  logApi.warn(Messages.get('DisplayWarning', msg));
};

export let logJson = function(msg: string): void {
  logApi.logJson(msg);
};

/**
 * return true for yes, false for no
 * @param msg
 * @returns {boolean}
 */
export let promptYesNo = function(msg: string): boolean {
  warning(msg);
  let decision = readline.promptCL();
  return decision[0].toLowerCase().startsWith('y');
};

export let debugLogs = function(logs: DebugLog[]): void {
  if (logs.length === 0) {
    logApi.log(Messages.get('DisplayNoLogs'));
  } else {
    logApi.table(logs, {
      columns: [
        { key: 'Application', label: Messages.get('DisplayHeaderApplication') },
        {
          key: 'DurationMilliseconds',
          label: Messages.get('DisplayHeaderDuration')
        },
        { key: 'Id', label: Messages.get('DisplayHeaderId') },
        { key: 'Location', label: Messages.get('DisplayHeaderLocation') },
        { key: 'LogLength', label: Messages.get('DisplayHeaderLogLength') },
        { key: 'LogUser.Name', label: Messages.get('DisplayHeaderLogUser') },
        { key: 'Operation', label: Messages.get('DisplayHeaderOperation') },
        { key: 'Request', label: Messages.get('DisplayHeaderRequest') },
        { key: 'StartTime', label: Messages.get('DisplayHeaderStartTime') },
        { key: 'Status', label: Messages.get('DisplayHeaderStatus') }
      ]
    });
  }
};

export let apiLimits = function(limits: ApiLimit[]): void {
  logApi.table(limits, {
    columns: [
      { key: 'name', label: Messages.get('DisplayHeaderName') },
      { key: 'remaining', label: Messages.get('DisplayHeaderRemaining') },
      { key: 'max', label: Messages.get('DisplayHeaderMaximum') }
    ]
  });
};

export let soqlQuery = function(columns: string[], records: Object[], totalCount: number) {
  prepNullValues(records);
  logApi.table(records, { columns });
  logApi.log(logApi.color.bold(Messages.get('DisplayQueryRecordsRetrieved', totalCount)));
};

let prepNullValues = function(records: Object[]): void {
  records.forEach(function(record: Object): void {
    for (let propertyKey in record) {
      if (record.hasOwnProperty(propertyKey)) {
        if (record[propertyKey] === null) {
          record[propertyKey] = logApi.color.bold('null');
        } else if (typeof record[propertyKey] === 'object') {
          prepNullValues([record[propertyKey]]);
        }
      }
    }
  });
};

export let bulkJobStatus = function(summary: JobInfo) {
  bulkStatus(summary, undefined, undefined, true);
};

export let bulkBatchStatus = function(summary: BatchInfo, results?: BatchResultInfo[], batchNum?: number): void {
  bulkStatus(summary, results, batchNum, false);
};

let bulkStatus = function(
  summary: JobInfo | BatchInfo,
  results?: BatchResultInfo[],
  batchNum?: number,
  isJob?: boolean
): void {
  info(''); // newline
  if (batchNum) {
    logApi.styledHeader(Messages.get('DisplayBulkBatch', batchNum));
  }
  if (results) {
    let errorMessages: string[] = [];
    results.forEach(function(result: BatchResultInfo): void {
      if (result['errors']) {
        result['errors'].forEach(function(errMsg: string): void {
          errorMessages.push(errMsg);
        });
      }
    });
    if (errorMessages.length > 0) {
      logApi.styledHeader(Messages.get('DisplayBulkError'));
      errorMessages.forEach(function(errorMessage): void {
        info(errorMessage);
      });
    }
  }

  let formatOutput: string[] = [];
  for (let field in summary) {
    if (summary.hasOwnProperty(field)) {
      formatOutput.push(field);
    }
  }
  // remove url field
  delete summary['$'];
  formatOutput.splice(0, 1);

  if (isJob) {
    logApi.styledHeader(Messages.get('DisplayBulkJobStatus'));
  } else {
    logApi.styledHeader(Messages.get('DisplayBulkBatchStatus'));
  }
  logApi.styledHash(summary, formatOutput);
};

export let record = function(rec: Object): void {
  recordHelper('', rec);
};

let recordHelper = function(indent: string, rec: Object): void {
  for (let property in rec) {
    if (!rec[property]) {
      info(indent + property + ': null');
    } else if (typeof rec[property] === 'object') {
      info(indent + property + ':');
      recordHelper(indent + '  ', rec[property]);
    } else if (Array.isArray(rec[property])) {
      rec[property].forEach(function(element) {
        recordHelper(indent + '  ', element);
      });
    } else {
      info(indent + property + ': ' + JSON.stringify(rec[property]));
    }
  }
};

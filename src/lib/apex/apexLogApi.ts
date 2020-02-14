/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Error from '../force-cli/force-cli-error';

import * as _ from 'lodash';

import * as Config from '../force-cli/force-cli-config';
import * as Display from '../force-cli/force-cli-display';
import logApi = require('../core/logApi');
import * as moment from 'moment';
import { Connection } from 'jsforce';

import StreamClient = require('../core/status');
import consts = require('../core/constants');

import util = require('util');

const TOPIC = '/systemTopic/Logging';
const TAIL_LISTEN_TIMEOUT_MIN = 30;
const LOG_TYPE = 'DEVELOPER_LOG';
const TRACE_FLAG_QUERY =
  'SELECT Id, DebugLevelId, StartDate, ExpirationDate FROM TraceFlag ' +
  "WHERE TracedEntityId = '%s' AND LogType = '%s'" +
  'ORDER BY CreatedDate DESC ' +
  'LIMIT 1';
const DEBUG_LEVEL_QUERY = "SELECT Id FROM DebugLevel WHERE DeveloperName = '%s'";
const DEFAULT_DEBUG_LEVEL_NAME = 'SFDC_DevConsole';

const DEFAULT_COLOR_MAP = {
  CONSTRUCTOR_: 'magenta',
  EXCEPTION_: 'red',
  FATAL_: 'red',
  METHOD_: 'blue',
  SOQL_: 'yellow',
  USER_: 'green',
  VARIABLE_: 'cyan'
};

export interface DebugLog {
  attributes: Object;
  Id: string;
  Application: string;
  DurationMilliseconds: number;
  Location: string;
  LogLength: string;
  LogUser: Object;
  Operation: string;
  Request: string;
  StartTime: string;
  Status: string;
}

export class ApexLogApi {
  private org;
  private force;
  private flags;
  private logger;

  /**
   * The API class that manages listing, getting, tailing Apex Debug logs.
   *
   * @param org {object} org from which to retrieve logs.
   */
  constructor(org, flags?) {
    this.org = org;
    this.force = org.force;
    this.flags = flags || {};
    this.logger = logApi.child('apexLogApi', { username: org.getName() });
  }

  tail() {
    const stream = new StreamClient(this.org);
    stream.waitInMinutes = TAIL_LISTEN_TIMEOUT_MIN;

    return new Promise((resolve, reject) => {
      return stream.subscribe(TOPIC, this._streamingCallback.bind(this), true).catch(err => {
        stream.disconnect();
        reject(err);
      });
    });
  }

  // setup or update traceflag need to stream logs
  async prepareTraceFlag(debugLevel: string) {
    const username: string = this.org.getName();
    const userId = await this._getUserId(username);
    let traceResult = await this._getTraceFlag(userId);

    // if existing, inspect to ensure it meets logging needs
    if (this._hasRecords(traceResult)) {
      let doUpdate = false;
      const traceFlag = traceResult.records[0];
      // expiration set to +30 from now to coincide w/ stream timeout
      const updatedExpirationDate = moment().add(TAIL_LISTEN_TIMEOUT_MIN, 'minutes');

      // must create a new traceflag if updated expiration date
      // exceeds 24hrs from start date
      const startDatePlus24 = moment(traceFlag.StartDate).add(24, 'hours');
      if (startDatePlus24.isBefore(updatedExpirationDate)) {
        // expired trace flag, gotta create new
        return this._createTraceFlag(userId);
      }

      // update w/ desired debug level
      if (debugLevel) {
        const debugLevelId = await this._getDebugLevelId(debugLevel);
        if (traceFlag.DebugLevelId !== debugLevelId) {
          traceFlag.DebugLevelId = debugLevelId;
          doUpdate = true;
        }
      }

      // adjust expiration date to coincide with stream timeout
      let expirationDate = moment(traceFlag.ExpirationDate);
      if (updatedExpirationDate.isAfter(expirationDate, 'minutes')) {
        traceFlag.ExpirationDate = updatedExpirationDate.format();
        doUpdate = true;
      }

      return doUpdate ? this.force.toolingUpdate(this.org, 'TraceFlag', traceFlag) : Promise.resolve();
    } else {
      return this._createTraceFlag(userId);
    }
  }

  async _getDebugLevelId(debugLevel: string) {
    const debugLevelResult = await this.force.toolingQuery(this.org, util.format(DEBUG_LEVEL_QUERY, debugLevel));
    if (!this._hasRecords(debugLevelResult)) {
      Error.exitWithMessage(`Debug Level not found for '${debugLevel}'`);
    }

    return debugLevelResult.records[0].Id;
  }

  async _getUserId(username: string): Promise<string> {
    const userQuery: string = `SELECT Id FROM User WHERE Username = '${username}'`;
    const userResult = await this.force.toolingQuery(this.org, userQuery);
    if (!this._hasRecords(userResult)) {
      Error.exitWithMessage(`User ID not found for user ${username}`);
    }

    return userResult.records[0].Id;
  }

  async _getTraceFlag(userId: string): Promise<any> {
    const traceQuery = util.format(TRACE_FLAG_QUERY, userId, LOG_TYPE);
    return await this.force.toolingQuery(this.org, traceQuery);
  }

  async _createTraceFlag(userId: string): Promise<any> {
    const DebugLevelId = await this._getDebugLevelId(DEFAULT_DEBUG_LEVEL_NAME);
    const traceFlagDate = moment();
    const traceFlag = {
      LogType: 'DEVELOPER_LOG',
      TracedEntityId: userId,
      StartDate: traceFlagDate.format(),
      ExpirationDate: traceFlagDate
        .clone()
        .add(TAIL_LISTEN_TIMEOUT_MIN, 'minutes')
        .format(),
      DebugLevelId
    };

    return this.force.toolingCreate(this.org, 'TraceFlag', traceFlag);
  }

  _streamingCallback(message: any) {
    // handle when stream listener aborts
    if (!_.isNil(message.errorName) && message.errorName === consts.LISTENER_ABORTED_ERROR_NAME) {
      // this is okay, but terminate listening
      return Promise.resolve();
    }

    if (message.sobject && message.sobject.Id) {
      // don't resolve so we keep listening
      this._handleTailMessage(message.sobject.Id);
    }

    // Something we're not interested in but we don't want to resolve the promise yet.
    return undefined;
  }

  async _handleTailMessage(logId: string): Promise<any> {
    const log = await this.getLogById(logId);

    if (log) {
      if (this.flags.json) {
        Display.logJson(log);
      } else {
        Display.info(this.flags.color ? this._colorizeLog(log.log) : log.log);
      }
    }
  }

  /**
   * fetch body of specific debug log
   * exposed for unit testing (mocked)
   * @param logId {string} logId - the debug log to retrieve
   */
  async logLog(logId: string): Promise<any> {
    const log = await this.getLogById(logId);

    if (log && !this.flags.json) {
      Display.info(this.flags.color ? this._colorizeLog(log.log) : log.log);
    }

    return log;
  }

  /**
   * Output log bodies of last N number of logs
   * @param numOfLogs {number} number of logs to retrieve
   */
  async logLogs(numOfRecentLogs: number): Promise<any> {
    const logs = [];
    const logRecords = await this.getRecentLogRecords(numOfRecentLogs);

    if (logRecords && logRecords.length > 0) {
      const logPromises = [];

      // retrieve log body and write to stdout (if not json)
      const logBodyFn = async logid => {
        const logBody = await this.logLog(logid);
        logs.push(logBody);
      };

      logRecords.forEach(logRecord => logPromises.push(logBodyFn(logRecord.Id)));
      await Promise.all(logPromises);
    }

    return logs;
  }

  _colorizeLog(log: string) {
    // default color registry
    let colorMap = DEFAULT_COLOR_MAP;

    // allow for color overrides
    const colorMapFile = process.env.SFDX_APEX_LOG_COLOR_MAP;
    if (colorMapFile) {
      try {
        colorMap = require(colorMapFile);
      } catch (err) {
        // fallback to default color registry
        this.logger.warn(`Color registry not found: ${colorMapFile}`);
      }
    }

    // split logs to colorize each logline
    const logLines = log.split(/\n/g);

    // return as-is if split fails
    if (!logLines || logLines.length < 1) {
      return logLines;
    }

    const colorizedLogLines = [];

    // bold first line to highlight separation between subsequent loglines
    colorizedLogLines.push(this._applyColor(logApi.color.bold, logLines[0]));

    // start on second line
    for (let i = 1, len = logLines.length; i < len; i++) {
      let logLine = logLines[i];

      // for each logline, loop thru seeing if there's an event match
      for (const [key, color] of _.entries(colorMap)) {
        if (logLine.includes(`|${key}`)) {
          const colorFn = logApi.color[color];

          // check for valid color
          if (typeof colorFn !== 'function') {
            this.logger.warn(`Color ${color} is not supported`);
            break;
          }

          // parse line to colorize event
          const cnt = (logLine.match(/\|/g) || []).length;
          if (cnt == 1) {
            // no trailing log
            logLine = this._applyColor(colorFn, logLine);
          } else {
            // colorize event (event up to 2nd '|')
            const first = logLine.indexOf('|', logLine.indexOf('|') + 1);
            logLine = this._applyColor(colorFn, logLine.substring(0, first)) + logLine.substring(first);
          }

          break;
        }
      }
      colorizedLogLines.push(logLine);
    }

    return colorizedLogLines.join('\n');
  }

  // apply color to logline part (method used for testing)
  _applyColor(colorFn: any, logLinePart: string) {
    return colorFn(logLinePart);
  }

  /**
   * fetch body of specific debug log
   * exposed for unit testing (mocked)
   * @param logId {string} logId - the debug log to retrieve
   */
  async getLogById(logId: string): Promise<any> {
    let conn: Connection = await Config.getActiveConnection({ org: this.org });
    let geturl: string = util.format(
      '%s/services/data/v%s/tooling/sobjects/ApexLog/%s/Body',
      conn.instanceUrl,
      conn.version,
      logId
    );
    let log = '';
    // We don't care about the callback because requestGet also returns a promise
    const response = await conn.request(geturl, () => {});
    log = response.toString();

    return { log };
  }

  /**
   * fetch most recent log records for given count
   * exposed for unit testing (mocked)
   * @param numOfRecentLogs {number} number of logs to retrieve
   */
  async getRecentLogRecords(numOfRecentLogs: number): Promise<any> {
    let conn: Connection = await Config.getActiveConnection({ org: this.org });
    let geturl = this._createLogListUrl(conn, numOfRecentLogs);
    let logs: DebugLog[] = [];
    await this._getReq(conn, geturl, function(response): void {
      logs = <DebugLog[]>response.records;
    });
    return logs;
  }

  _createLogListUrl(conn: Connection, numOfRecentLogs?: number): string {
    const limitQuery = numOfRecentLogs && numOfRecentLogs > 0 ? `+DESC+LIMIT+${numOfRecentLogs}` : '';
    return util.format(
      '%s/services/data/v%s/tooling/query/?q=' +
        'Select+Id,+Application,+DurationMilliseconds,+Location,+LogLength,+LogUser.Name,+Operation,+Request,StartTime,+Status+' +
        'From+ApexLog+' +
        'Order+By+StartTime' +
        '%s',
      conn.instanceUrl,
      conn.version,
      limitQuery
    );
  }

  async _getReq(conn: Connection, geturl: string, callback: (res) => void): Promise<void> {
    const logger = this.logger;
    await conn.request(geturl, function(err: Error, response) {
      if (err) {
        logger.error(err);
        Error.exitWithMessage(err.message);
      }
      callback(response);
    });
  }

  /**
   * fetch summary information for all debug logs
   * exposed for unit testing (mocked)
   */
  async listLogs(): Promise<DebugLog[]> {
    try {
      let conn: Connection = await Config.getActiveConnection({
        org: this.org
      });
      let geturl = this._createLogListUrl(conn);
      let logs: DebugLog[] = [];
      await this._getReq(conn, geturl, function(response): void {
        logs = <DebugLog[]>response.records;
        // shorten ISO format by removing milliseconds, but retain timezone information
        logs.forEach(function(log: DebugLog) {
          let msStart = log.StartTime.indexOf('.');
          let msEnd = msStart + 4;
          let timezone = '';
          if (log.StartTime.length > msEnd) {
            timezone = log.StartTime.substring(msEnd, log.StartTime.length);
          }
          log.StartTime = log.StartTime.substring(0, msStart) + timezone;
        });
        Display.debugLogs(logs);
      });
      return logs;
    } catch (err) {
      this.logger.error(err);
      return Error.exitWithMessage(err.message);
    }
  }

  _hasRecords(result: any) {
    return result && result.records && result.records.length > 0;
  }
}

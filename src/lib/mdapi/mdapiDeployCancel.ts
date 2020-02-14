/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, AuthInfo, SfdxError } from '@salesforce/core';
import { OAuth2Options } from 'jsforce';

import { Config } from '../core/configApi';
import DeployReport = require('../mdapi/mdapiDeployReportApi');

export interface MdapiDeployCancelOptions {
  jobid: string;
  wait?: number;
  deprecatedStatusRequest?: boolean;
  result?: MdapiDeployCancelOutput;
}

export interface MdapiDeployCancelOutput {
  done: boolean;
  id: string;
}

// TODO Create a more broad interface for MDDeployReportOutput and have this one extend from that. See MdapiDeployReportApi
export interface MDDeployCancelReportOutput {
  canceledBy: string;
  canceledByName: string;
  checkOnly: boolean;
  completedDate: string;
  createdBy: string;
  createdByName: string;
  createdDate: string;
  details: {
    componentSuccesses: string[];
    runTestResult: {
      numFailures: string;
      numTestsRun: string;
      totalTime: string;
    };
  };
  done: boolean;
  id: string;
  ignoreWarnings: boolean;
  lastModifiedDate: string;
  numberComponentErrors: number;
  numberComponentsDeployed: number;
  numberComponentsTotal: number;
  numberTestErrors: number;
  numberTestsCompleted: number;
  numberTestsTotal: number;
  runTestsEnabled: string;
  startDate: string;
  status: string;
  success: boolean;
}

/**
 * API that wraps Metadata API to cancel a deployment from a given org.
 *
 * @param force
 * @constructor
 */
export class MdapiDeployCancel {
  private _reporter: any;

  constructor(org: any) {
    this._reporter = new DeployReport(org);
  }

  // Get a @salesforce/core Connection, which extends jsforce.Connection.
  private async _getCoreConnection(username: string, authConfig: OAuth2Options): Promise<Connection> {
    const conn = await Connection.create({
      authInfo: await AuthInfo.create({ username, oauth2Options: authConfig })
    });
    conn.setApiVersion(new Config().getApiVersion());
    return conn;
  }

  private _checkCancelStatus(
    result: MdapiDeployCancelOutput,
    options: MdapiDeployCancelOptions
  ): MDDeployCancelReportOutput {
    options.deprecatedStatusRequest = !!options.jobid;
    options.jobid = options.jobid || result.id;
    options.result = result;
    return this._reporter.report(options);
  }

  public async cancel(orgApi: any, options: MdapiDeployCancelOptions): Promise<MDDeployCancelReportOutput> {
    const username = orgApi.getName();
    const connection = await this._getCoreConnection(username, username ? null : orgApi.authConfig);
    try {
      // TODO: A method should be added to jsforce for cancelDeploy()
      const result = await connection.metadata['_invoke']('cancelDeploy', {
        id: options.jobid
      });
      return await this._checkCancelStatus(result, options);
    } catch (err) {
      throw SfdxError.create('salesforce-alm', 'mdapi_cancel', 'CancelFailed', [err.message]);
    }
  }
}

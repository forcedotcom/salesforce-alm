/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxError } from '@salesforce/core';

import Alias = require('../core/alias');
import { AsyncCreatable } from '@salesforce/kit';
import * as requestPromise from 'request-promise-native';
import { Messages, Logger } from '@salesforce/core';
import Org = require('../core/scratchOrgApi');
import { Config as ConfigApi } from '../core/configApi';
import { ConfigAggregator } from '@salesforce/core';

const urls = require('../urls');

Messages.importMessagesDirectory(__dirname);
const defaultConnectedAppInfo = require('../core/defaultConnectedApp');

interface BaseRequest {
  method: string;
  url: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  interval: number;
  user_code: string;
  verification_uri: string;
}

interface DeviceCodeFormParams {
  client_id: string;
  response_type?: string;
  code?: string;
  grant_type?: string;
  scope?: string;
}

export interface DeviceCodeRequest extends BaseRequest {
  form: DeviceCodeFormParams;
}

export interface DeviceCodePollingResponse {
  access_token: string;
  refresh_token: string;
  signature: string;
  scope: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
}

export interface DeviceLoginOptions {
  clientid?: string;
  loglevel: string;
  instanceurl?: string;
  setalias?: string;
  setdefaultdevhubusername?: boolean;
  setdefaultusername?: boolean;
}

export interface AuthInfoResponse {
    orgId: string;
    accessToken?: string;
    refreshToken?: string;
    instanceUrl: string;
    loginUrl: string;
    username: string;
    clientId: string;
}

enum LogLevel {
  ERROR = 'error', WARN = 'warn', INFO = 'info', DEBUG = 'debug'
}

export class DeviceFlowService extends AsyncCreatable<DeviceLoginOptions> {
  // Public Statics
  public static RESPONSE_TYPE = 'device_code';
  public static GRANT_TYPE = 'device';
  public static SCOPE = 'refresh_token web api';

  public static getLoginOptions(deviceFlowRequestUrl: string, clientId: string) {
    return {
      method: 'POST',
      url: deviceFlowRequestUrl,
      form: {
        response_type: DeviceFlowService.RESPONSE_TYPE,
        client_id: clientId || DeviceFlowService.DEFAULT_CLIENT_ID, 
        scope: DeviceFlowService.SCOPE
      } as DeviceCodeFormParams,
      json: true
    };
  }

  public static getPollingOptions(
    deviceFlowUrl: string,
    loginData: DeviceCodeResponse,
    clientId: string
  ): DeviceCodeRequest {
    return {
      method: 'POST',
      url: deviceFlowUrl,
      json: true,
      form: {
        grant_type: DeviceFlowService.GRANT_TYPE,
        code: loginData.device_code,
        client_id: clientId || DeviceFlowService.DEFAULT_CLIENT_ID
      } as DeviceCodeFormParams
    } as DeviceCodeRequest;
  }

  // Private Statics
  private static DEFAULT_CLIENT_ID = defaultConnectedAppInfo.clientId;
  private static POLLING_COUNT_MAX = 100;

  // Private
  private loginHost;
  private _force;
  private logger!: Logger;

  // Public
  public request = requestPromise;
  public timeout: any;
  public pollingCount: number = 0;
  public clientId: string;
  public instanceUrl: string;
  public logLevel: string;
  public setDefaultUsername: boolean;
  public setDefaultDevhubUsername: boolean;
  public alias: string;

  constructor(options: DeviceLoginOptions) {
    super(options);
    this.clientId = options.clientid;
    this.instanceUrl = options.instanceurl;
    this.logLevel = options.loglevel;
    this.alias = options.setalias;
    this.setDefaultDevhubUsername = options.setdefaultdevhubusername;
    this.setDefaultUsername = options.setdefaultusername;
  }

  public async getDeviceFlowRequestUrl(instanceUrl: string) {
    this.loginHost = await DeviceFlowService.getInstanceUrl(this.force, instanceUrl);
    return `${this.loginHost}/services/oauth2/token`;
  }

  public async getUserProfileUrl(instanceUrl: string) {
    this.loginHost = await DeviceFlowService.getInstanceUrl(this.force, instanceUrl);
    return `${this.loginHost}/services/oauth2/userinfo`;
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.logger.debug(`this.clientId: ${this.clientId}`);
    this.logger.debug(`this.instanceUrl: ${this.instanceUrl}`);
  }

  get force() {
    if (!this._force) {
      const Force = require('../core/force'); // eslint-disable-line global-require
      this._force = this._force || new Force(new ConfigApi());
    }
    return this._force;
  }
  set force(force) {
    this._force = force || this._force;
  }

  public static getType(deviceFlowService: DeviceFlowService) {
    let type;
    if (deviceFlowService.setDefaultUsername) {
      type = Org.Defaults.USERNAME;
    } else if (deviceFlowService.setDefaultDevhubUsername) {
      type = Org.Defaults.DEVHUB;
    }
    return type;
  }

  /**
   * TODO: This would be a good method to share between web and device auth
   * @param force 
   * @param instanceUrl 
   */
  public static async getInstanceUrl(force, instanceUrl) {
    let promise;
    if (instanceUrl) {
      // Always use the command line instance first;
      return instanceUrl;
    } else {
      // Check the env var before local config
      promise = ConfigAggregator.create().then(aggregator => {
        const instance: any = aggregator.getInfo('instanceUrl');

        if (instance.isEnvVar()) {
          return instance.val;
        } else {
          return force.config.getAppConfigIfInWorkspace().sfdcLoginUrl || instance.val || urls.production;
        }
      });
    }
    return promise;
  }

  public logHelper(level, append) {
    level = level || 'debug';
    this.logger[level](`clientId: ${this.clientId}`);
    this.logger[level](`instanceUrl: ${this.instanceUrl}`);
    this.logger[level](`loginHost: ${this.loginHost}`);
    if (append) { 
      this.logger[level](append); 
    }
  }

  public async requestDeviceLogin(): Promise<DeviceCodeResponse> {
    const deviceFlowRequestUrl = await this.getDeviceFlowRequestUrl(this.instanceUrl);
    const loginOptions = await DeviceFlowService.getLoginOptions(deviceFlowRequestUrl, this.clientId);
    return this.request(loginOptions);
  }

  public createPollingFunction(
    interval: number,
    resolve: Function,
    reject: Function,
    pollingOptions: DeviceCodeRequest
  ) {
    return async function repeatedPollingFunction() {
      if (this.pollingCount > DeviceFlowService.POLLING_COUNT_MAX) {
        // stop polling, the user has likely abandoned the command...
        clearTimeout(this.timeout);
        this.logHelper(LogLevel.ERROR, `Polling timed out because max polling was hit: ${this.pollingCount}`);
        reject(SfdxError.create('salesforce-alm', 'auth', 'device.errors.pollingTimeout'));
      } else {
        try {
          const pollingResponse = await this.getDeviceApproval(pollingOptions);
          clearTimeout(this.timeout);
          resolve(pollingResponse);
        } catch (err) {
          if (err.statusCode === 400 && err.error.error === 'authorization_pending') {
            this.timeout = setTimeout(repeatedPollingFunction.bind(this), interval);
          } else {
            clearTimeout(this.timeout);
            if (err.error && err.error.error) {
              this.logHelper(LogLevel.ERROR, `Polling error: ${err.error.error}: ${err.error.error_description}`);
            } else {
              this.logHelper(LogLevel.ERROR, `Unknown Polling Error: ${err}`);
            }
            reject(err);
          }
        }
        this.pollingCount++;
      }
    }.bind(this);
  }

  public startPolling(resolve, reject, loginData, pollingOptions) {
    const interval = loginData.interval * 1000;
    const callback = this.createPollingFunction(interval, resolve, reject, pollingOptions);
    this.timeout = setTimeout(callback, interval);
  }

  public async awaitDeviceApproval(loginData: DeviceCodeResponse): Promise<DeviceCodePollingResponse> {
    const deviceFlowRequestUrl = await this.getDeviceFlowRequestUrl(this.instanceUrl);
    const pollingOptions = DeviceFlowService.getPollingOptions(deviceFlowRequestUrl, loginData, this.clientId);
    return new Promise((resolve, reject) => {
      this.startPolling(resolve, reject, loginData, pollingOptions);
    });
  }

  public async getDeviceApproval(pollingOptions: DeviceCodeRequest): Promise<DeviceCodePollingResponse> {
    return this.request(pollingOptions);
  }

  public async authorizeAndSave(approval: DeviceCodePollingResponse, clientSecret: string): Promise<AuthInfoResponse> {
    let orgApi = new Org(this.force, DeviceFlowService.getType(this));
    orgApi.alias = this.alias;
    /**
     * We can't reuse the access_token here because the force library requires a
     * redirect_uri, which we do not have in device flow.  It will exchange the
     * refresh token for a new access token and store that.
     *
     * "ERROR running force:auth:device:login:  redirect_uri must match configuration"
     */
    return this.force.authorizeAndSave(
      {
        instanceUrl: approval.instance_url,
        loginUrl: approval.instance_url,
        refreshToken: approval.refresh_token,
        clientSecret,
        clientId: this.clientId || DeviceFlowService.DEFAULT_CLIENT_ID
      },
      orgApi,
      !!DeviceFlowService.getType(this),
      (() => {
        throw SfdxError.create('salesforce-alm', 'auth', 'device.errors.demoModeSupport');
      }).bind(this)
    );
  }

  public async doSetAlias(username) {
    if (this.alias && this.alias.length) {
      return Alias.set(this.alias, username);
    } else {
      return undefined;
    }
  }


}

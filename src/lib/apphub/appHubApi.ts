/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import * as _ from 'lodash';

import logApi = require('../core/logApi');

// endpoint registry
export const APPHUB_ENDPOINTS = {
  discover: 'discover',
  envAcccess: 'environmentAccesses'
};

const LOGGER = logApi.child('AppHub');

// app config for installed apphub
export class AppHubInfo {
  constructor(private appHubAppConfig = { versions: [] }) {}

  getConfig(): any {
    return this.appHubAppConfig;
  }

  getVersions(): String[] {
    return this.appHubAppConfig.versions;
  }
}

export interface AppHubApi {
  getAppInfo(): AppHubInfo;
  postScratchOrgCreate(scratchOrgInfoResponse: any, scratchOrg: any): Promise<any>;
  doThrowErrors(): void; // for testing
}

/**
 * No operation AppHub API.  DevHub does not have AppHub installed.
 */
class BaseAppHubApiImpl implements AppHubApi {
  protected appHubInfo;
  protected username;
  protected hostname;
  protected throwErrors = false;

  constructor(protected appHubOrg, appHubAppConfig) {
    this.appHubInfo = new AppHubInfo(appHubAppConfig);

    // obtain invoking username to pass to apphub
    try {
      this.username = os.userInfo().username;
    } catch (err) {
      try {
        this.username = process.env['USER'];
      } catch (err) {
        LOGGER.warn(`Unable to get username.`);
        this.username = 'n/a';
      }
    }

    // obtain hostname to pass to apphub
    try {
      this.hostname = os.hostname();
    } catch (err) {
      try {
        this.hostname = process.env['HOSTNAME'];
      } catch (err) {
        LOGGER.warn(`Unable to get hostname.`);
        this.hostname = 'n/a';
      }
    }
  }

  getAppInfo(): AppHubInfo {
    return this.appHubInfo;
  }

  async postScratchOrgCreate(scratchOrgInfoResponse: any, scratchOrg: any): Promise<any> {
    throw new Error('Not implemented!');
  }

  getLatestVersionEndpoint(endpoint: string): string {
    const versions = this.appHubInfo.getVersions();
    const endpointVersions = versions[endpoint];
    if (!endpointVersions || endpointVersions.length == 0) {
      throw new Error(`Endpoint versions not found for ${endpoint}`);
    }

    return `${endpoint}/${endpointVersions[0]}`;
  }

  doThrowErrors(): void {
    this.throwErrors = true;
  }
}

/**
 * No operation AppHub API.  Org may not be a DevHub or AppHub is not installed.
 */
export class NoOpAppHubApiImpl implements AppHubApi {
  private appHubInfo;

  constructor() {
    this.appHubInfo = new AppHubInfo();
  }

  getAppInfo(): AppHubInfo {
    return this.appHubInfo;
  }

  async postScratchOrgCreate(scratchOrgInfoResponse: any, scratchOrg: any): Promise<any> {
    // apphub not installed or general no-op
  }

  doThrowErrors(): void {
    // apphub not installed or general no-op
  }
}
export const NOOP = new NoOpAppHubApiImpl();

/**
 * Handles AppHub API interactions.
 */
class AppHubApiImpl extends BaseAppHubApiImpl {
  // handle new scratch orgs
  async postScratchOrgCreate(scratchOrgInfoResponse: any, scratchOrg: any): Promise<any> {
    // TODO: get impl based on latest supported endpoint version

    let endpoint;

    try {
      // set scratch org values to env record values
      const scratchOrgConfig = await scratchOrg.getConfig();
      const envAccess = {
        AccessToken__c: scratchOrgConfig.accessToken,
        AuthCode__c: scratchOrgInfoResponse.AuthCode,
        ConnectedAppCallbackUrl__c: scratchOrgInfoResponse.ConnectedAppCallbackUrl,
        ConnectedAppClientSecret__c: scratchOrgConfig.clientSecret,
        ConnectedAppConsumerKey__c: scratchOrgInfoResponse.ConnectedAppConsumerKey,
        InstanceUrl__c: scratchOrgConfig.instanceUrl,
        InstanceName__c: scratchOrgInfoResponse.SignupInstance,
        IsAuthCodeExpired__c: true, // auth token already used by CLI create process
        OrgId__c: scratchOrgInfoResponse.ScratchOrg,
        RefreshToken__c: scratchOrgConfig.refreshToken,
        Username__c: scratchOrgInfoResponse.SignupUsername,
        ClientUsername__c: this.username,
        ClientHostname__c: this.hostname
      };

      // send access to apphub
      endpoint = this.getLatestVersionEndpoint(APPHUB_ENDPOINTS.envAcccess);
      const response = await this.appHubOrg.force.apexRestPost(this.appHubOrg, endpoint, [envAccess]);
      LOGGER.debug(`Saved accesses: ${response}`);
      return response;
    } catch (err) {
      LOGGER.warn(
        `Unable to send accesses to AppHub (${endpoint}, ${scratchOrgInfoResponse.ScratchOrg}): ${err.message}`
      );

      if (this.throwErrors) {
        throw err;
      }

      return [];
    }
  }
}

/**
 * Creates AppHub API instance for given Org.
 *
 * No-op API is returned if:
 *   - Org is NOT a DevHub (determined via local config),
 *   - AppHub is not installed,
 *   - AppHub CLI integration is disabled via SFDX_DISABLE_APP_HUB,
 *   - Error occurs
 *
 * @param hubOrg
 * @returns {Promise<AppHubApi>}
 */
export async function getAppHub(hubOrg: any): Promise<AppHubApi> {
  try {
    // !!!  NOTE  !!!
    // AppHub is shelved until further notice.  Salesforce CLI functionality
    // is *disabled*, but can be enabled via SFDX_DISABLE_APP_HUB=false.

    // env var to disable AppHub interactions
    const disable = process.env.SFDX_DISABLE_APP_HUB || 'true';
    const isDisabled = !_.isNil(disable) && disable.toLowerCase() === 'true';

    // must be enabled
    if (isDisabled || !hubOrg) {
      return NOOP;
    }

    // must be DevHub
    const isDevHubOrg = await hubOrg.isDevHubOrg();
    if (!isDevHubOrg) {
      return NOOP;
    }

    // AppHub must be installed
    // TODO: set timeout to min
    const response = await hubOrg.force.apexRestGet(hubOrg, APPHUB_ENDPOINTS.discover);
    if (!response) {
      throw new Error(`AppHub /${APPHUB_ENDPOINTS.discover} endpoint not found`);
    }

    // extract AppHub app config from response
    const swagger = _.isString(response) ? JSON.parse(response) : response;
    const appHubAppConfig = swagger['x-apphub'];
    if (!appHubAppConfig) {
      throw new Error('AppHub config not found');
    }

    LOGGER.info('AppHub integration enabled');
    return new AppHubApiImpl(hubOrg, appHubAppConfig);
  } catch (err) {
    LOGGER.warn(`Unable to discover AppHub: ${err.message}`);

    // use no-op api
    return NOOP;
  }
}

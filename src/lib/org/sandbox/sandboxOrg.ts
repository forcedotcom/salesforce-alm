/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Org, Logger, AuthInfo, AuthFields, Messages } from '@salesforce/core';
import { SfdxError, SfdxErrorConfig } from '@salesforce/core';
import { SandboxConstants, SandboxEventNames } from './sandboxConstants';
import {
  SandboxOrgApi,
  SandboxRequest,
  SandboxProcessObject,
  SandboxUserAuthRequest,
  SandboxUserAuthResponse
} from './sandboxOrgApi';
import { Duration, sleep } from '@salesforce/kit';
import { EventEmitter } from 'events';
import * as ConfigApi from '../../../lib/core/configApi';
import srcDevUtil = require('../../core/srcDevUtil');
import { SandboxOrgConfig } from '@salesforce/core/lib/config/sandboxOrgConfig';

Messages.importMessagesDirectory(__dirname);

export class SandboxOrg extends EventEmitter {
  public api: SandboxOrgApi;

  constructor(
    private prodOrg: Org,
    private wait: Duration,
    private logger: Logger,
    private userSuppliedClientId?: string
  ) {
    super();
    this.api = SandboxOrgApi.getInstance(prodOrg, logger);
  }

  public static getInstance(prodOrg: Org, wait: Duration, logger: Logger, clientId?: string) {
    return new SandboxOrg(prodOrg, wait, logger, clientId);
  }

  /**
   *
   * @param sandboxReq - the sandbox creation request object
   * @param sandboxName
   */
  public async cloneSandbox(sandboxReq: SandboxRequest, sandboxName: string): Promise<SandboxProcessObject> {
    if (sandboxName) {
      sandboxReq.SourceId = await this.api.querySandboxInfoIdBySandboxName(sandboxName);
      this.logger.debug('Clone sandbox sourceId %s', sandboxReq.SourceId);
    }

    return this.createSandbox(sandboxReq);
  }

  /**
   *
   * @param masterProdOrg - the production org that is authed... the sandbox is created from this org
   * @param sandboxReq - the sandbox creation request object
   * @param maxPollingRetries - calculated based on wait and polling interval
   * @param logapi
   */
  public async createSandbox(sandboxReq: SandboxRequest): Promise<SandboxProcessObject> {
    const sandboxProcessObj = await this.api.createSandbox(sandboxReq);
    return await this.authWithRetries(sandboxProcessObj);
  }

  public async authWithRetriesByName(sandboxProcessName: string): Promise<SandboxProcessObject> {
    return this.authWithRetries(await this.api.queryLatestSandboxProcessBySandboxName(sandboxProcessName));
  }

  private async authWithRetries(sandboxProcessObj: SandboxProcessObject): Promise<SandboxProcessObject> {
    let maxPollingRetries = this.getMaxPollingRetries();
    this.logger.debug(
      'AuthWithRetries sandboxProcessObj %s, maxPollingRetries %i',
      sandboxProcessObj,
      maxPollingRetries
    );
    return await this.pollStatusAndAuth(sandboxProcessObj, maxPollingRetries, maxPollingRetries > 0);
  }

  protected getMaxPollingRetries() {
    return this.wait
      ? this.wait.seconds / SandboxConstants.DEFAULT_POLL_INTERVAL.seconds
      : SandboxConstants.DEFAULT_MAX_RETRIES;
  }

  private async getAuthInfoFields(): Promise<AuthFields> {
    if (this.userSuppliedClientId) {
      //give out warning we do not support -i flag for the command
      this.emit(SandboxEventNames.EVENT_CLIENTID_NOTSUPPORT, this.userSuppliedClientId);
    } else {
      //return the prod org auth file client id
      return await this.prodOrg.getConnection().getAuthInfoFields();
    }
  }

  private async writeAuthFile(sandboxProcessObj: SandboxProcessObject, sandboxRes: SandboxUserAuthResponse) {
    this.logger.debug('writeAuthFile sandboxProcessObj: %s, sandboxRes: %s', sandboxProcessObj, sandboxRes);
    if (sandboxRes.authUserName) {
      let authFields: AuthFields = await this.getAuthInfoFields();
      this.logger.debug('Result from getAuthInfoFields: AuthFields %s', authFields);

      //let's do headless auth via jwt
      const oauth2Options = {
        clientId: authFields.clientId,
        loginUrl: sandboxRes.loginUrl,
        instanceUrl: sandboxRes.instanceUrl,
        username: sandboxRes.authUserName,
        privateKeyFile: authFields.privateKey
      };

      const authInfo = await AuthInfo.create({ username: sandboxRes.authUserName, oauth2Options });
      await authInfo.save();
      let sandboxOrg = await Org.create({ aliasOrUsername: authInfo.getUsername() });
      await sandboxOrg.setSandboxOrgConfigField(SandboxOrgConfig.Fields.PROD_ORG_USERNAME, authFields.username);

      this.emit(SandboxEventNames.EVENT_RESULT, {
        sandboxProcessObj,
        sandboxRes
      });
    } else {
      //no authed sandbox user, error
      throw SfdxError.create(
        new SfdxErrorConfig('salesforce-alm', 'org', 'missingAuthUsername', [sandboxProcessObj.SandboxName])
      );
    }
  }

  private async validateSandboxCompleteAndGetAuthenticationInfo(
    sandboxProcessObj: SandboxProcessObject
  ): Promise<SandboxUserAuthResponse> {
    this.logger.debug(
      'validateSandboxCompleteAndGetAuthenticationInfo called with SandboxProcessObject %s',
      sandboxProcessObj
    );
    let endDate = sandboxProcessObj.EndDate;
    let result: SandboxUserAuthResponse = null;
    if (endDate) {
      try {
        //call server side /sandboxAuth API to auth the sandbox org user with the connected app
        const config = new ConfigApi.Config();
        let authFields: AuthFields = await this.getAuthInfoFields();

        let sandboxReq: SandboxUserAuthRequest = new SandboxUserAuthRequest();
        sandboxReq.clientId = authFields.clientId;
        sandboxReq.callbackUrl = config.getOauthCallbackUrl();
        sandboxReq.sandboxName = sandboxProcessObj.SandboxName;

        this.logger.debug('Calling sandboxAuth with SandboxUserAuthRequest %s', sandboxReq);
        result = await this.api.sandboxAuth(sandboxReq);
        this.logger.debug('Result of calling sandboxAuth %s', result);
      } catch (err) {
        //THere are cases where the endDate is set before the sandbox has actually completed.
        // In that case, the sandboxAuth call will throw a specific exception.
        // TODO when we fix the SandboxProcess.Status field to be a proper enum, remove extra checks
        if (err.name == SandboxConstants.SANDBOX_INCOMPLETE_EXCEPTION_MESSAGE) {
          this.logger.debug('Error while authenticating the user %s', err.toString());
        } else {
          //If it fails for any unexpected reason, just pass that through
          throw err;
        }
      }
    }

    return result;
  }

  /**
   *
   * @param sandboxProcessObj - 0GR000xxx, latest non deleted sandbox process id we got from the sandbox creation
   * @param retries : number - calculated based on wait and polling interval
   * @param shouldPoll : boolean - used to determine if the initial call to the recursive function is intended to poll
   */
  protected async pollStatusAndAuth(
    sandboxProcessObj: SandboxProcessObject,
    retries: number,
    shouldPoll: boolean
  ): Promise<SandboxProcessObject> {
    this.logger.debug('PollStatusAndAuth called with SandboxProcessObject %s, retries %1', sandboxProcessObj, retries);
    let pollFinished = false;
    let waitingOnAuth = false;
    let response: SandboxUserAuthResponse = await this.validateSandboxCompleteAndGetAuthenticationInfo(
      sandboxProcessObj
    );
    if (response) {
      try {
        await this.writeAuthFile(sandboxProcessObj, response);
        pollFinished = true;
      } catch (err) {
        this.logger.debug('Exception while calling writeAuthFile %s', err);
        // This is a really gross way to find out if the error is the expected "JWT can't auth user because it hasn't been replicated" exception
        //   but I couldn't think of a better way because the exception is so sparsely populated (no stack trace, no particular exception type)
        // -wm
        if (err.name == 'JWTAuthError' && err.stack.includes("user hasn't approved")) {
          waitingOnAuth = true;
        } else {
          throw err;
        }
      }
    }
    if (!pollFinished) {
      if (retries > 0) {
        this.emit(SandboxEventNames.EVENT_STATUS, {
          sandboxProcessObj,
          interval: SandboxConstants.DEFAULT_POLL_INTERVAL.seconds,
          retries,
          waitingOnAuth
        });
        await sleep(SandboxConstants.DEFAULT_POLL_INTERVAL);
        let polledSandboxProcessObj: SandboxProcessObject = await this.api.querySandboxProcessById(
          sandboxProcessObj.Id
        );
        return this.pollStatusAndAuth(polledSandboxProcessObj, retries - 1, shouldPoll);
      } else {
        if (shouldPoll) {
          //timed out on retries
          throw SfdxError.create(
            new SfdxErrorConfig('salesforce-alm', 'org', 'pollingTimeout', [sandboxProcessObj.Status])
          );
        } else {
          //The user didn't want us to poll, so simply return the status
          //simply report status and exit
          this.emit(SandboxEventNames.EVENT_ASYNCRESULT, { sandboxProcessObj });
        }
      }
    }
    return sandboxProcessObj;
  }

  /**
   *
   * @param masterProdOrg - the production org that is authed... the sandbox is created from this org
   * @param sandboxReq - the sandbox creation request object
   * @param maxPollingRetries - calculated based on wait and polling interval
   * @param logapi
   */
  public async deleteSandbox(sandboxOrgId: string) {
    let shortId = srcDevUtil.trimTo15(sandboxOrgId);
    let sandboxProcessObject: SandboxProcessObject = await this.api.querySandboxProcessBySandboxOrgId(shortId);
    await this.api.deleteSandbox(sandboxProcessObject.SandboxInfoId);
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxError, Org, Messages, Logger } from '@salesforce/core';
import { Tooling } from '@salesforce/core/lib/connection';
Messages.importMessagesDirectory(__dirname);

export class SandboxRequest {
  SandboxName: string;
  LicenseType?: string;
  SourceId?: string;
  Description?: string;
}

export interface SandboxProcessObject {
  Id: string;
  Status: string;
  SandboxName: string;
  SandboxInfoId: string;
  LicenseType: string;
  CreatedDate: string;
  SandboxOrganization?: string;
  CopyProgress?: number;
  SourceId?: string;
  Description?: string;
  ApexClassId?: string;
  EndDate?: string;
}

export interface SandboxUserAuthResponse {
  authUserName: string;
  authCode: string;
  instanceUrl: string;
  loginUrl: string;
}

export class SandboxUserAuthRequest {
  sandboxName: string;
  clientId: string;
  callbackUrl: string;
}

export class SandboxOrgApi {
  static readonly SOBJECT_SANDBOXPROCESS: string = 'SandboxProcess';
  static readonly SOBJECT_SANDBOXINFO: string = 'SandboxInfo';
  static readonly QUERY_SANDBOXPROCESS_FIELDS: string =
    'Id, Status, SandboxName, SandboxInfoId, LicenseType, CreatedDate, CopyProgress, SandboxOrganization, SourceId, Description, EndDate ';
  static readonly QUERY_SANDBOXINFO_FIELDS: string = 'Id, SandboxName ';

  private tooling: Tooling;

  public constructor(org: Org, private logger: Logger) {
    this.tooling = org.getConnection().tooling;
  }

  public static getInstance(org: Org, logger: Logger) {
    return new SandboxOrgApi(org, logger);
  }

  public async createSandbox(sandboxReq: SandboxRequest): Promise<SandboxProcessObject> {
    this.logger.debug('CreateSandbox called with SandboxRequest: %s ', sandboxReq);
    const createResult = await this.tooling.create(SandboxOrgApi.SOBJECT_SANDBOXINFO, sandboxReq);
    this.logger.debug('Return from calling tooling.create: %s ', createResult);

    if (!Array.isArray(createResult) && createResult.success) {
      const sandboxInfoId = createResult.id;
      const info = await this.queryLatestSandboxProcessBySandboxInfo(sandboxInfoId);
      this.logger.debug('Return from calling queryLatestSandboxProcessBySandboxInfo: %s ', info);
      return info;
    } else {
      throw SfdxError.create('salesforce-alm', 'org', 'SandboxInfoCreateFailed', [createResult.toString()]);
    }
  }

  /**
   *
   * @param processId
   * @returns sandboxProcess record in json
   */
  public async querySandboxProcessById(processId: string): Promise<SandboxProcessObject> {
    this.logger.debug('QuerySandboxProcessById called with SandboxProcessId: %s ', processId);
    const queryStr: string = `SELECT ${SandboxOrgApi.QUERY_SANDBOXPROCESS_FIELDS} FROM ${SandboxOrgApi.SOBJECT_SANDBOXPROCESS} WHERE Id='${processId}' AND Status != 'D' ORDER BY CreatedDate DESC LIMIT 1`;
    let record: SandboxProcessObject = await this.queryToolingApi(
      queryStr,
      'SandboxProcessNotFoundById',
      'MultiSandboxProcessFoundById',
      [processId],
      [processId]
    );
    this.logger.debug('Return from calling queryToolingApi: %s ', record);
    return record;
  }

  public async querySandboxProcessBySandboxOrgId(sandboxOrgId: string): Promise<SandboxProcessObject> {
    this.logger.debug('QuerySandboxProcessById called with SandboxOrgId: %s ', sandboxOrgId);
    const queryStr: string = `SELECT ${SandboxOrgApi.QUERY_SANDBOXPROCESS_FIELDS} FROM ${SandboxOrgApi.SOBJECT_SANDBOXPROCESS} WHERE SandboxOrganization ='${sandboxOrgId}' AND Status NOT IN ('D', 'E') ORDER BY CreatedDate DESC LIMIT 1`;
    let record: SandboxProcessObject = await this.queryToolingApi(
      queryStr,
      'sandboxProcessNotFoundByOrgId',
      'multiSandboxProcessFoundByOrgId',
      [sandboxOrgId],
      [sandboxOrgId]
    );
    this.logger.debug('Return from calling queryToolingApi: %s ', record);
    return record;
  }

  public async queryUserId(userNameIn: string): Promise<string> {
    this.logger.debug('QueryUserId called with UserName: %s ', userNameIn);
    const queryStr: string = `SELECT Id FROM User WHERE Username='${userNameIn}'`;
    let userRecord = await this.queryToolingApi(queryStr, 'UserNotFound', 'MultiUserFound', [userNameIn], [userNameIn]);
    this.logger.debug('Return from calling queryToolingApi: %s ', userRecord);
    return userRecord.Id;
  }

  /**
   *
   * @param sandboxNameIn
   * @returns sandboxInfoId
   */
  public async querySandboxInfoIdBySandboxName(sandboxNameIn: string): Promise<string> {
    this.logger.debug('QuerySandboxInfoIdBySandboxName called with SandboxName: %s ', sandboxNameIn);
    const queryStr: string = `SELECT ${SandboxOrgApi.QUERY_SANDBOXINFO_FIELDS} FROM ${SandboxOrgApi.SOBJECT_SANDBOXINFO} WHERE SandboxName='${sandboxNameIn}'`;
    let record = await this.queryToolingApi(
      queryStr,
      'SandboxInfoNotFound',
      'MultiSandboxInfoFound',
      [sandboxNameIn],
      [sandboxNameIn]
    );
    this.logger.debug('Return from calling queryToolingApi: %s ', record);
    return record.Id;
  }

  public async queryLatestSandboxProcessBySandboxName(sandboxNameIn: string): Promise<SandboxProcessObject> {
    this.logger.debug('QueryLatestSandboxProcessBySandboxName called with SandboxName: %s ', sandboxNameIn);
    const queryStr: string = `SELECT ${SandboxOrgApi.QUERY_SANDBOXPROCESS_FIELDS} FROM ${SandboxOrgApi.SOBJECT_SANDBOXPROCESS} WHERE SandboxName='${sandboxNameIn}' AND Status != 'D' ORDER BY CreatedDate DESC LIMIT 1`;
    let record: SandboxProcessObject = await this.queryToolingApi(
      queryStr,
      'SandboxProcessNotFoundBySandboxName',
      'MultiSandboxProcessNotFoundBySandboxName',
      [sandboxNameIn],
      [sandboxNameIn]
    );
    this.logger.debug('Return from calling queryToolingApi: %s ', record);
    return record;
  }

  private async queryLatestSandboxProcessBySandboxInfo(sandboxInfoIdIn: string): Promise<SandboxProcessObject> {
    this.logger.debug('QueryLatestSandboxProcessBySandboxInfo called with SandboxInfoId: %s ', sandboxInfoIdIn);
    const queryStr: string = `SELECT ${SandboxOrgApi.QUERY_SANDBOXPROCESS_FIELDS} FROM ${SandboxOrgApi.SOBJECT_SANDBOXPROCESS} WHERE SandboxInfoId='${sandboxInfoIdIn}' AND Status != 'D' ORDER BY CreatedDate DESC LIMIT 1`;
    let record: SandboxProcessObject = await this.queryToolingApi(
      queryStr,
      'SandboxProcessNotFoundByInfoId',
      'MultiSandboxProcessFoundByInfoId',
      [sandboxInfoIdIn],
      [sandboxInfoIdIn]
    );
    this.logger.debug('Return from calling queryToolingApi: %s ', record);
    return record;
  }

  private async queryToolingApi(
    queryStrIn: string,
    key0: string,
    key1: string,
    tokens0?: string[],
    tokens1?: string[]
  ): Promise<any> {
    this.logger.debug(
      'QueryToolingApi called with queryStrIn: %s, key0: %s, key1: %s, tokens0: %s, tokens1: %s ',
      queryStrIn,
      key0,
      key1,
      tokens0,
      tokens1
    );
    const queryResult = await this.tooling.query(queryStrIn);
    this.logger.debug('Return from calling tooling.query: %s ', queryResult);

    if (queryResult.records && queryResult.records.length === 1) {
      return queryResult.records[0];
    } else if (queryResult.records && queryResult.records.length > 1) {
      throw SfdxError.create('salesforce-alm', 'org', key1, tokens1);
    } else {
      throw SfdxError.create('salesforce-alm', 'org', key0, tokens0);
    }
  }

  public async sandboxAuth(request: SandboxUserAuthRequest): Promise<SandboxUserAuthResponse> {
    this.logger.debug('SandboxAuth called with SandboxUserAuthRequest: %s', request);
    let url = [this.tooling._baseUrl(), 'sandboxAuth'].join('/');
    let params = {
      method: 'POST',
      url: url,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    };

    return <SandboxUserAuthResponse>await this.tooling.request(params);
  }

  public async deleteSandbox(sandboxInfoId: string): Promise<SandboxProcessObject> {
    this.logger.debug('DeleteSandbox called with SandboxInfoId: %s ', sandboxInfoId);
    const deleteResult = await this.tooling.delete(SandboxOrgApi.SOBJECT_SANDBOXINFO, sandboxInfoId);
    this.logger.debug('Return from calling tooling.delete: %s ', deleteResult);

    if (!Array.isArray(deleteResult) && deleteResult.success) {
      return;
    } else {
      throw SfdxError.create('salesforce-alm', 'org', 'sandboxDeleteFailed', [deleteResult.toString()]);
    }
  }
}

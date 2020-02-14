/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholely superceded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

// Node
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as URL from 'url';
import * as util from 'util';

// Thirdparty
import * as BBPromise from 'bluebird';
import * as jsforce from 'jsforce';
import * as jwt from 'jsonwebtoken';
import * as optional from 'optional-js';
import * as _ from 'lodash';
import * as requestModule from 'request';
const { AuthInfo, Connection } = require('@salesforce/core');

const dns = BBPromise.promisifyAll(require('dns'));
const fsReadFile = BBPromise.promisify(fs.readFile);

// Local
import { Config } from './configApi';
import logger = require('./logApi');
import * as jwtAudience from './jwtAudienceUrl';
import * as almError from './almError';
import messages = require('../messages');
import srcDevUtil = require('./srcDevUtil');
import consts = require('./constants');
import { SfdxError } from '@salesforce/core';

const defaultConnectedAppInfo = require('./defaultConnectedApp');
const describeMetadataResponse = path.join(__dirname, '..', '..', '..', 'metadata', 'describe.json');

const jsforceRequestMethod = jsforce.Connection.prototype.request;
const callOptionsValue = {
  client: srcDevUtil.getSfdxCLIClientId()
};

// Get a @salesforce/core Connection, which extends jsforce.Connection.
const getCoreConnection = async (username, options?) => {
  const conn = await Connection.create({
    authInfo: await AuthInfo.create({ username, oauth2Options: options })
  });
  conn.setApiVersion(new Config().getApiVersion());
  return conn;
};

/**
 * Internally we want to override jsforce::connection so we can inject our own http headers for all requests.
 * JSforce has limited support for enabling HTTP headers, only certain apis support the http header option.
 * With this strategy all requests are supported. Also see status.js. StreamingApi is managed as well.
 */
jsforce.Connection.prototype.request = function(request, options, callback) {
  const _request = srcDevUtil.setSfdxRequestHeaders(request, options);
  return jsforceRequestMethod.apply(this, [_request, options, callback]);
};

const Force = function(config?) {
  this.config = optional.ofNullable(config).orElse(new Config());
  this.logger = logger.child('force');
  // We don't want jsforce errors getting printed to the console. handling these errors or sending them to the log file
  // is desired. The false argument disables human readable for this child logger.
  this.loggerForJsforce = logger.child('jsforce', undefined, false);
};

/**
 * generates a code verifier value for use in web server oauth; used to prevent replay attacks.
 */
Force.prototype.generateCodeChallenge = function() {
  this.codeVerifier = srcDevUtil.base64UrlEscape(crypto.randomBytes(Math.ceil(128)).toString('base64'));
};

Force.prototype.debug = function(orgApi, msg) {
  if (this.logger.isDebugEnabled()) {
    if (orgApi && orgApi.getName) {
      this.logger.setConfig('org', orgApi.getName());
    }
    this.logger.debug(msg);
  }
};

const _configJsforceLogger = function(conn) {
  conn._logger = this.loggerForJsforce;
  conn.tooling._logger = this.loggerForJsforce;
  return conn;
};

const _getJsforceDirectConnection = function(connectData) {
  return _configJsforceLogger.call(this, new jsforce.Connection(connectData));
};

Force.prototype.authorize = function(oauthConfig) {
  const oauth2 = new jsforce.OAuth2(oauthConfig);
  const connection = _getJsforceDirectConnection.call(this, { oauth2 });

  let jsforceOauth2PostParams;

  if (this.codeVerifier) {
    const _codeVerifier = this.codeVerifier;
    jsforceOauth2PostParams = jsforce.OAuth2.prototype['_postParams'];
    /**
     * This post params override is necessary because jsforce's oauth impl doesn't support
     * coder_verifier and code_challenge. This enables the server to disallow trading a one-time auth code
     * for an access/refresh token when the verifier and challege are out of alignment.
     *
     * See - https://github.com/jsforce/jsforce/issues/665
     */
    jsforce.OAuth2.prototype['_postParams'] = function(params, callback) {
      _.set(params, 'code_verifier', _codeVerifier);
      return jsforceOauth2PostParams.call(connection.oauth2, params, callback);
    };
  }

  return BBPromise.resolve(connection.authorize(oauthConfig.authCode))
    .then(() => connection.query(`SELECT Username FROM User WHERE Id = '${connection.userInfo.id}'`))
    .then(response => ({
      orgId: connection.userInfo.organizationId,
      username: response.records[0].Username,
      accessToken: connection.accessToken,
      instanceUrl: connection.instanceUrl,
      refreshToken: connection.refreshToken,
      loginUrl: oauthConfig.loginUrl
    }))
    .finally(() => {
      if (this.codeVerifier) {
        jsforce.OAuth2.prototype['_postParams'] = jsforceOauth2PostParams.bind(connection.oauth2);
      }
    });
};

Force.prototype.getConfig = function() {
  return this.config;
};

const _parseIdUrl = function(idUrl) {
  const idUrls = idUrl.split('/');
  const userId = idUrls.pop();
  const orgId = idUrls.pop();

  return {
    id: userId,
    organizationId: orgId,
    url: idUrl
  };
};

const _jwtAuthorize = function(token, orgInstanceAuthority) {
  // Extend OAuth2 to add JWT Bearer Token Flow support.
  const JwtOAuth2 = function() {
    return Object.assign(Object.create(jsforce.OAuth2), {
      jwtAuthorize(innerToken, callback) {
        return this.prototype._postParams(
          {
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: innerToken
          },
          callback
        );
      }
    });
  };
  const oauth2 = JwtOAuth2();
  oauth2.prototype.constructor({ loginUrl: orgInstanceAuthority });

  // Authenticate using JWT, then build and return a connection
  // containing the instanceUrl and accessToken information.
  let connection;
  return (
    oauth2
      .jwtAuthorize(token)
      // check dns to see if instance url is available, if not fallback to orgInstanceAuthority
      .then(response =>
        dns
          .lookupAsync(URL.parse(response.instance_url).hostname)
          .then(() =>
            BBPromise.resolve({
              instanceUrl: response.instance_url,
              accessToken: response.access_token,
              userInfo: _parseIdUrl(response.id)
            })
          )
          .catch(() =>
            BBPromise.resolve({
              instanceUrl: orgInstanceAuthority,
              accessToken: response.access_token,
              userInfo: _parseIdUrl(response.id)
            })
          )
      )
      .then(connectionParams => {
        connection = _getJsforceDirectConnection.call(this, connectionParams);
        return connection;
      })
      .then(localConnection =>
        localConnection.query(`SELECT Username FROM User WHERE Id = '${connection.userInfo.id}'`)
      )
      .then(response => ({
        orgId: connection.userInfo.organizationId,
        username: response.records[0].Username,
        accessToken: connection.accessToken,
        instanceUrl: connection.instanceUrl,
        loginUrl: orgInstanceAuthority
      }))
  );
};

Force.prototype.jwtAuthorize = function(oauthConfig) {
  return fsReadFile(oauthConfig.privateKeyFile, 'utf8')
    .then(privateKey => {
      const audienceUrl = jwtAudience.getJwtAudienceUrl(oauthConfig);

      return jwt.sign(
        {
          iss: oauthConfig.clientId,
          sub: oauthConfig.username,
          aud: audienceUrl,
          exp: Date.now() + 300
        },
        privateKey,
        {
          algorithm: 'RS256'
        }
      );
    })
    .then(token => BBPromise.resolve(_jwtAuthorize.call(this, token, oauthConfig.loginUrl)))
    .catch(error => {
      throw SfdxError.create('salesforce-alm', 'auth', 'JwtGrantError', [error.message]);
    });
};

Force.prototype.refreshTokenAuthorize = function(orgApi, oauthConfig) {
  // Since the orgid hasn't been saved, it is using the old connected app
  if (_.isNil(oauthConfig.clientId)) {
    oauthConfig.clientId = defaultConnectedAppInfo.legacyClientId;
    oauthConfig.clientSecret = defaultConnectedAppInfo.legacyClientSecret;
  }

  let connection;
  const oauth2 = new jsforce.OAuth2(oauthConfig);
  return oauth2
    .refreshToken(oauthConfig.refreshToken)
    .then((response: any) => {
      connection = _getJsforceDirectConnection.call(this, {
        instanceUrl: response.instance_url,
        accessToken: response.access_token,
        userInfo: _parseIdUrl(response.id)
      });
    })
    .then(() => connection.query(`SELECT Username FROM User WHERE Id = '${connection.userInfo.id}'`))
    .then(response => ({
      orgId: connection.userInfo.organizationId,
      username: response.records[0].Username,
      accessToken: connection.accessToken,
      instanceUrl: connection.instanceUrl,
      refreshToken: oauthConfig.refreshToken,
      loginUrl: oauthConfig.loginUrl || oauthConfig.instanceUrl
    }));
};

Force.prototype.saveOrgAuthData = function(
  thisLogger,
  authObject,
  oauthConfig,
  isJwt,
  saveAsDefault,
  orgApi,
  trialExpirationDate
) {
  thisLogger.debug(`Authenticated new org: ${authObject.orgId} for user ${authObject.username} with authcode.`);

  const orgSaveData = authObject;
  orgSaveData.clientId = oauthConfig.clientId;
  orgSaveData.createdOrgInstance = oauthConfig.createdOrgInstance;
  orgSaveData.created = oauthConfig.created;
  orgSaveData.devHubUsername = oauthConfig.devHubUsername;
  orgSaveData.scratchAdminUsername = oauthConfig.scratchAdminUsername;
  orgSaveData.userId = oauthConfig.userId;
  orgSaveData.userProfileName = oauthConfig.userProfileName;
  orgSaveData.trialExpirationDate = trialExpirationDate;

  if (isJwt) {
    orgSaveData.privateKey = oauthConfig.privateKeyFile;
  } else {
    orgSaveData.clientSecret = oauthConfig.clientSecret;
  }
  return orgApi.saveConfig(orgSaveData, saveAsDefault);
};

/**
 * Authenticates into an org via either the jwt flow or the web server oauth flow
 * and saves the resulting config to disk
 * (checks for the jwt flow first)
 * @param oauthConfig
 * @param orgApi
 * @param saveAsDefault {boolean} - whether to save this org as the default for this workspace.
 * @returns {json} - the org api values with encrypted secrets. Call get config to decrypt.
 */

Force.prototype.authorizeAndSave = function(oauthConfig, orgApi, saveAsDefault, handleDemoModePrompt) {
  let promise;
  let isJwt = false;

  if (!_.isNil(oauthConfig.privateKeyFile)) {
    isJwt = true;
    promise = this.jwtAuthorize(oauthConfig);
  } else if (_.isNil(oauthConfig.authCode) && !_.isNil(oauthConfig.refreshToken)) {
    promise = this.refreshTokenAuthorize(orgApi, oauthConfig);
  } else {
    promise = this.authorize(oauthConfig);
  }

  return promise.then(authObject => {
    if (this.logger.getEnvironmentMode().isDemo()) {
      const query = `SELECT TrialExpirationDate FROM Organization WHERE Id = \'${authObject.orgId}\'`;

      // Add the authObject to the orgApi so it can be used to get a @salesforce/core Connection.
      orgApi.authConfig = Object.assign({}, authObject);

      return this.query(orgApi, query).then(result => {
        const trialExpirationDate =
          result && result.records.length === 1 ? result.records[0].TrialExpirationDate : null;
        if (!trialExpirationDate) {
          // for auth:web:login, we need to prompt after redirecting the login page, and then
          // save the auth data as needed, so pass along relevant info
          const possibleError = new Error();
          possibleError.name = 'AuthNotSaved';
          if (!handleDemoModePrompt) {
            _.set(possibleError, 'authObject', authObject);
            _.set(possibleError, 'trialExpirationDate', trialExpirationDate);
            return BBPromise.reject(possibleError);
          }

          return handleDemoModePrompt(authObject.username).then(answer => {
            if (answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y') {
              return this.saveOrgAuthData(
                this.logger,
                authObject,
                oauthConfig,
                isJwt,
                saveAsDefault,
                orgApi,
                trialExpirationDate
              );
            }

            return BBPromise.reject(possibleError);
          });
        }
        return this.saveOrgAuthData(
          this.logger,
          authObject,
          oauthConfig,
          isJwt,
          saveAsDefault,
          orgApi,
          trialExpirationDate
        );
      });
    } else {
      return this.saveOrgAuthData(this.logger, authObject, oauthConfig, isJwt, saveAsDefault, orgApi);
    }
  });
};

const _create = function(sobjectName, sobjectData, connection) {
  const sobject = connection.sobject(sobjectName);
  return sobject
    .describe()
    .then(() => sobject.create(sobjectData))
    .catch(err => {
      if (err.errorCode === 'NOT_FOUND') {
        err['message'] = messages().getMessage('createOrgCommandUnauthorized', sobjectName);
        err['name'] = 'ACCESS_DENIED';
      }
      throw err;
    });
};

Force.prototype.create = function(orgApi, sobjectName, sobject) {
  this.debug(orgApi, `create: ${sobjectName}`, { sobject });

  return this._getConnection(orgApi, this.config).then(connection => _create(sobjectName, sobject, connection));
};

Force.prototype.update = function(orgApi, sobjectName, sobject) {
  this.debug(orgApi, `update: ${sobjectName}, ${sobject}`);

  return this._getConnection(orgApi, this.config).then(connection => connection.sobject(sobjectName).update(sobject));
};

Force.prototype.delete = function(orgApi, sobjectName, id) {
  this.debug(orgApi, `delete: ${sobjectName}, ${id}`);

  return this._getConnection(orgApi, this.config).then(connection => connection.sobject(sobjectName).delete(id));
};

Force.prototype.describe = function(orgApi, sobjectName) {
  this.debug(orgApi, `describe: ${sobjectName}`);

  return this._getConnection(orgApi, this.config).then(connection => connection.sobject(sobjectName).describe());
};

Force.prototype.find = function(orgApi, sobjectName, conditions, fields) {
  return this._getConnection(orgApi, this.config).then(connection =>
    connection.sobject(sobjectName).find(conditions, fields)
  );
};

Force.prototype.getOrgFrontDoor = function(orgApi, tryRefresh = true) {
  // Calling a simple describe on the data API so the access token can be updated if needed.
  return (tryRefresh ? this.describeData(orgApi) : BBPromise.resolve())
    .then(() => this._getConnection(orgApi, this.config))
    .then(() => orgApi.getConfig())
    .then(orgData => `${_.trimEnd(orgData.instanceUrl, '/')}/secur/frontdoor.jsp?sid=${orgData.accessToken}`);
};

Force.prototype.getAuthorizationUrl = function(oauthConfig) {
  const oauth2 = new jsforce.OAuth2(oauthConfig);

  // The state parameter allows the redirectUri callback listener to ignore request that don't contain the state value.
  const state = crypto.randomBytes(Math.ceil(6)).toString('hex');
  const params = {
    state,
    prompt: 'login',
    response_type: 'code',
    scope: 'refresh_token api web'
  };

  if (this.codeVerifier) {
    // code verifier must be a base 64 url encoded hash of 128 bytes of random data. Our random data is also
    // base 64 url encoded. See Force.prototype.generateCodeChallenge();
    const codeChallenge = srcDevUtil.base64UrlEscape(
      crypto
        .createHash('sha256')
        .update(this.codeVerifier)
        .digest('base64')
    );
    _.set(params, 'code_challenge', codeChallenge);
  }

  return oauth2.getAuthorizationUrl(params);
};

Force.prototype.describeData = function(orgApi) {
  return this._getConnection(orgApi, this.config).then(connection => connection.requestGet(connection._baseUrl()));
};

Force.prototype.login = function(orgApi, creds, oauth2) {
  const auth = {
    oauth2
  };
  auth.oauth2.loginUrl = this.config.getAppConfig().sfdcLoginUrl;

  const connection = _getJsforceDirectConnection.call(this, auth);
  return connection.login(creds.username, creds.password).then(() => ({
    accessToken: connection.accessToken,
    instanceUrl: connection.instanceUrl,
    refreshToken: connection.refreshToken
  }));
};

// NOTE: All queries will auto fetch results up to 10,000 records.
Force.prototype.query = async function(orgApi, query) {
  this.debug(orgApi, `query: ${query}`);
  const orgUserName = orgApi.getName();
  const options = orgUserName ? null : orgApi.authConfig;
  const connection = await getCoreConnection(orgUserName, options);

  return connection.autoFetchQuery(query);
};

Force.prototype.retrieve = function(orgApi, sobjectName, id) {
  this.debug(orgApi, `toolingRetrieve: ${sobjectName}, ${id}`);

  return this._getConnection(orgApi, this.config).then(connection => connection.sobject(sobjectName).retrieve(id));
};

Force.prototype.runTestsAsynchronous = function(orgApi, data) {
  return this._getConnection(orgApi, this.config).then(connection => {
    const url = `${connection.tooling._baseUrl()}/runTestsAsynchronous`;
    const request = {
      method: 'POST',
      url,
      body: JSON.stringify(data),
      headers: { 'content-type': 'application/json' }
    };
    return connection.tooling.request(request);
  });
};

Force.prototype.runTestsSynchronous = function(orgApi, data) {
  return this._getConnection(orgApi, this.config).then(connection => {
    const url = `${connection.tooling._baseUrl()}/runTestsSynchronous`;
    const request = {
      method: 'POST',
      url,
      body: JSON.stringify(data),
      headers: { 'content-type': 'application/json' }
    };
    return connection.tooling.request(request);
  });
};

Force.prototype.getApiVersions = function(orgApi) {
  return orgApi.getConfig().then(orgConfig => {
    const url = `${orgConfig.instanceUrl}/services/data`;
    return this.request(orgApi, 'GET', url, this.config);
  });
};

Force.prototype.getAsyncJob = function(orgApi, testRunId) {
  const query = `SELECT Id, Status, JobItemsProcessed, TotalJobItems, NumberOfErrors
        FROM AsyncApexJob
        WHERE ID = '${testRunId}'`;
  return this.toolingQuery(orgApi, query);
};

Force.prototype.getAsyncTestStatus = function(orgApi, testRunId) {
  const query = `SELECT Id, Status, ApexClassId, TestRunResultID FROM ApexTestQueueItem WHERE ParentJobId = '${testRunId}'`;
  return this.toolingQuery(orgApi, query);
};

Force.prototype.getAsyncTestResults = function(orgApi, apexTestQueueItemIds, chunkSize = consts.DEFAULT_CHUNKSIZE) {
  const query = `SELECT Id, QueueItemId, StackTrace, Message, AsyncApexJobId, MethodName, Outcome, ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix, RunTime
        FROM ApexTestResult WHERE QueueItemId IN (%s)`;
  /*
   * For queries having large number of apex test classes more than 1000,
   * the query is split and executed to avoid socket timeout issues.
   */
  const apexTestBatches =
    apexTestQueueItemIds.length > chunkSize ? _.chunk(apexTestQueueItemIds, chunkSize) : [apexTestQueueItemIds];
  const queryPromises = apexTestBatches.map(queryParam => {
    const soqlIds = `'${queryParam.join("','")}'`;
    return () => this.toolingQuery(orgApi, util.format(query, soqlIds));
  });
  /* Reducing the array of promises to one single promise and returning it*/
  return srcDevUtil.parallelExecute(queryPromises).then(res =>
    res.reduce((allRecords, currentResult) => {
      currentResult.records.forEach(element => {
        allRecords.records.push(element);
      });
      allRecords['totalSize'] += currentResult.records.length;
      return allRecords;
    })
  );
};

Force.prototype.getApexTestRunResult = function(orgApi, testRunId) {
  const query = `SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, MethodsEnqueued, StartTime, EndTime, TestTime, UserId
        FROM ApexTestRunResult
        WHERE AsyncApexJobId = '${testRunId}'`;
  return this.toolingQuery(orgApi, query);
};

Force.prototype.getApexCodeCoverage = function(orgApi) {
  const orgWideCoverageQuery = 'SELECT PercentCovered FROM ApexOrgWideCoverage';
  const apexCodeCoverageQuery = `SELECT ApexTestClass.Id, ApexTestClass.Name, Coverage, TestMethodName, NumLinesCovered,
            ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, NumLinesUncovered FROM ApexCodeCoverage`;

  return this.toolingQuery(orgApi, orgWideCoverageQuery).then(owcResults =>
    this.toolingQuery(orgApi, apexCodeCoverageQuery).then(accResults => {
      accResults.orgWideCoverage = owcResults.records[0].PercentCovered;
      return accResults;
    })
  );
};

Force.prototype.toolingCreate = function(orgApi, sobjectName, sobject) {
  this.debug(orgApi, `toolingCreate: ${sobjectName}`, { sobject });

  return this._getConnection(orgApi, this.config).then(connection =>
    connection.tooling.sobject(sobjectName).create(sobject)
  );
};

Force.prototype.toolingUpdate = function(orgApi, sobjectName, sobject) {
  return this._getConnection(orgApi, this.config).then(connection =>
    connection.tooling.sobject(sobjectName).update(sobject)
  );
};

Force.prototype.toolingDelete = function(orgApi, sobjectName, id) {
  return this._getConnection(orgApi, this.config).then(connection =>
    connection.tooling.sobject(sobjectName).delete(id)
  );
};

Force.prototype.toolingFind = function(orgApi, sobjectName, conditions, fields) {
  return this._getConnection(orgApi, this.config).then(connection =>
    connection.tooling.sobject(sobjectName).find(conditions, fields)
  );
};

Force.prototype.toolingDescribe = function(orgApi, sobjectName) {
  return this._getConnection(orgApi, this.config).then(connection =>
    connection.tooling.sobject(sobjectName).describe()
  );
};

// NOTE: all tooling queries will auto fetch results up to 10,000 records.
Force.prototype.toolingQuery = async function(orgApi, query) {
  this.debug(orgApi, `toolingQuery: ${query}`);
  const orgUserName = orgApi.getName();
  const options = orgUserName ? null : orgApi.authConfig;
  const connection = await getCoreConnection(orgUserName, options);

  return connection.tooling.autoFetchQuery(query);
};

Force.prototype.toolingRetrieve = function(orgApi, sobjectName, id) {
  this.debug(orgApi, `toolingRetrieve: ${sobjectName}, ${id}`);

  return this._getConnection(orgApi, this.config).then(connection =>
    connection.tooling.sobject(sobjectName).retrieve(id)
  );
};

// generic request to given URL w/ body and headers
Force.prototype.request = function(orgApi, method, url, headers, body) {
  this.debug(orgApi, `request: ${url}`);
  if (_.isNil(headers)) {
    headers = {};
  }
  return this._getConnection(orgApi, this.config).then(connection => {
    if (connection.accessToken) {
      headers.Authorization = `Bearer ${connection.accessToken}`;
    }

    // ensure string body
    body = _.isString(body) ? body : JSON.stringify(body);

    const _request = BBPromise.promisify(connection.request).bind(connection);
    return _request({
      method,
      url,
      body,
      headers
    });
  });
};

Force.prototype.requestStreamUrl = function(orgApi, url, stream) {
  this.debug(orgApi, `requestStreamUrl: ${url}`);

  const _callback = err => {
    if (!_.isNil(err)) {
      return BBPromise.reject(err);
    }
    return BBPromise.resolve(undefined);
  };

  return this._getConnection(orgApi, this.config).then(connection => {
    const headers: any = {};
    if (connection.accessToken) {
      headers.Authorization = `Bearer ${connection.accessToken}`;
    }

    const resp = connection.request({ url, headers }, _callback);
    resp.stream().pipe(stream); // resp.stream() waits for the promise to be resolved.
    return resp; // but this will be unresolved almost certainly, and will block any caller mapping.
  });
};

// invoke apex rest resource
Force.prototype.apexRestGet = function(orgApi, resource, headers = {}) {
  return orgApi
    .getConfig()
    .then(orgConfig => `${orgConfig.instanceUrl}/services/apexrest/${resource}`)
    .then(url => this.request(orgApi, 'GET', url, headers));
};

Force.prototype.apexRestPost = function(orgApi, resource, body, headers = {}) {
  return orgApi
    .getConfig()
    .then(orgConfig => `${orgConfig.instanceUrl}/services/apexrest/${resource}`)
    .then(url => this.request(orgApi, 'POST', url, headers, body));
};

Force.prototype.connectApiGet = async function(orgApi, resource) {
  const orgUserName = orgApi.getName();
  const connection = await getCoreConnection(orgUserName, orgUserName ? null : orgApi.authConfig);
  const url = `${connection.baseUrl()}/connect/${resource}`;
  return connection.request(url);
};

Force.prototype.connectApiPost = async function(orgApi, resource, messageBody) {
  const orgUserName = orgApi.getName();
  const connection = await getCoreConnection(orgUserName, orgUserName ? null : orgApi.authConfig);
  const url = `${connection.baseUrl()}/connect/${resource}`;
  const body = JSON.stringify(messageBody);
  const options = {
    url: `${url}`,
    method: 'POST',
    body
  };
  return connection.request(options);
};

Force.prototype.mdapiSoapDeploy = function(orgApi, zipStream, options) {
  return this._getConnection(orgApi, this.config).then(connection =>
    connection.metadata.deploy(zipStream, options || {})
  );
};

Force.prototype.setRestHeaders = function(connection) {
  const headers: any = {};
  const client = 'client=';
  headers.Authorization = connection && `OAuth ${connection.accessToken}`;
  headers.clientId = connection.oauth2 && connection.oauth2.clientId;
  headers['Sforce-Call-Options'] = client + callOptionsValue.client;
  return headers;
};

Force.prototype.mdapiRestDeploy = function(orgApi, zipStream, options) {
  let headers = {};

  return this._getConnection(orgApi, this.config)
    .then(connection => {
      headers = this.setRestHeaders(connection);
      return `${connection.instanceUrl}/services/data/v${this.config.getApiVersion()}/metadata/deployRequest`;
    })
    .then(
      url =>
        new BBPromise((resolve, reject) => {
          const r = requestModule.post(url, { headers }, (err, httpResponse, body) => {
            body = JSON.parse(body);
            if (err || httpResponse.statusCode > 300) {
              let error;
              if (body[0].errorCode === 'API_DISABLED_FOR_ORG') {
                error = almError('mdDeployCommandCliNoRestDeploy');
              } else {
                error = new Error(`${body[0].errorCode}: ${body[0].message}`);
              }
              reject(error);
            } else {
              resolve(body);
            }
          });
          const form = r.form();

          // Add the zip file
          form.append('file', zipStream, {
            contentType: 'application/zip'
          } as any);

          // Add the deploy options
          form.append('entity_content', JSON.stringify({ deployOptions: options }), {
            contentType: 'application/json'
          } as any);
        })
    );
};

Force.prototype.mdapiCheckDeployStatus = function(orgApi, jobId) {
  return this._getConnection(orgApi, this.config).then(connection =>
    connection.metadata.checkDeployStatus(jobId, true)
  );
};

Force.prototype.mdapiCheckRetrieveStatus = function(orgApi, jobId) {
  return this._getConnection(orgApi, this.config)
    .then(connection => connection.metadata.checkRetrieveStatus(jobId))
    .then(result => {
      result.success = result.success === 'true';
      result.done = result.done === 'true';
      return result;
    });
};

// metadata api retrieve; options contains what to retrieve
Force.prototype.mdapiRetrieve = function(orgApi, options) {
  return this._getConnection(orgApi, this.config).then(connection => connection.metadata.retrieve(options));
};

Force.prototype.mdapiDescribe = function() {
  // TODO remove the following return and call describeMetadata. see W-3683088 and W-3680564
  return fsReadFile(describeMetadataResponse, 'utf8')
    .then(JSON.parse)
    .then(res => {
      res.metadataObjects = _.isArray(res.metadataObjects) ? res.metadataObjects : [res.metadataObjects];
      res.metadataObjects = _.map(res.metadataObjects, mo => {
        if (mo.childXmlNames) {
          mo.childXmlNames = _.isArray(mo.childXmlNames) ? mo.childXmlNames : [mo.childXmlNames];
        }
        mo.inFolder = mo.inFolder === 'true';
        mo.metaFile = mo.metaFile === 'true';
        return mo;
      });
      res.partialSaveAllowed = res.partialSaveAllowed === 'true';
      res.testRequired = res.testRequired === 'true';
      return res;
    });
};

Force.prototype.jwtConn = function(org, orgAuthConfig, connectData) {
  const refreshFn = function(conn, callback) {
    org.force.logger.info('Access token has expired. Updating...');
    const oauthConfig = {
      loginUrl: orgAuthConfig.loginUrl || org.config.getAppConfigIfInWorkspace().sfdcLoginUrl,
      privateKeyFile: orgAuthConfig.privateKey
    };
    Object.assign(orgAuthConfig, oauthConfig);

    return org.force
      .authorizeAndSave(orgAuthConfig, org)
      .then(() => org.getConfig())
      .then(orgData => callback(null, orgData.accessToken))
      .catch(err => {
        if (_.isString(err.message) && err.message.includes('Data Not Available')) {
          return callback(almError('OrgDataNotAvailableError', [org.name], 'OrgDataNotAvailableErrorAction'));
        }
        return callback(err);
      });
  };

  // JWT bearer token OAuth flow
  Object.assign(connectData, {
    refreshFn,
    instanceUrl: orgAuthConfig.instanceUrl,
    accessToken: orgAuthConfig.accessToken
  });

  return _getJsforceDirectConnection.call(this, connectData);
};

Force.prototype.oauthConn = function(org, orgAuthConfig, connectData) {
  // Web Server OAuth flow
  Object.assign(connectData, {
    oauth2: {
      loginUrl: orgAuthConfig.instanceUrl || this.config.getAppConfig().sfdcLoginUrl,
      clientId: orgAuthConfig.clientId,
      clientSecret: orgAuthConfig.clientSecret,
      redirectUri: org.config.getOauthCallbackUrl()
    },
    instanceUrl: orgAuthConfig.instanceUrl,
    accessToken: orgAuthConfig.accessToken,
    refreshToken: orgAuthConfig.refreshToken
  });

  const connection = _getJsforceDirectConnection.call(this, connectData);
  connection.on('refresh', accessToken =>
    org.getConfig().then(orgData => {
      this.logger.info('Access token has expired. Updating...');
      orgData.accessToken = accessToken;
      return org.saveConfig(orgData);
    })
  );
  return connection;
};
Force.prototype.setCallOptions = function(key, value) {
  callOptionsValue[key] = value;
};

Force.prototype._getConnection = function(org, config, oauthConfig) {
  const connectData = {
    version: config.getApiVersion(),
    callOptions: callOptionsValue
  };

  return (oauthConfig ? BBPromise.resolve(oauthConfig) : org.getConfig())
    .then(orgAuthConfig => {
      if (_.isNil(orgAuthConfig.refreshToken) && _.isNil(orgAuthConfig.privateKey)) {
        // Just auth with the accessToken
        this.logger.info('Getting connection from access token');
        Object.assign(connectData, orgAuthConfig);
        return _getJsforceDirectConnection.call(this, connectData);
      } else if (_.isNil(orgAuthConfig.refreshToken)) {
        this.logger.info('Getting connection from jwt auth config');
        return this.jwtConn(org, orgAuthConfig, connectData);
      } else {
        this.logger.info('Getting connection from oauth config');
        return this.oauthConn(org, orgAuthConfig, connectData);
      }
    })
    .then(conn => _configJsforceLogger.call(this, conn));
};

export = Force;

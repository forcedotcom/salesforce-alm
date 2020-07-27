/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Duration } from '@salesforce/kit';
import { Logger, MyDomainResolver, SfdxError, AuthFields, AuthInfo } from '@salesforce/core';

// Node
import { URL } from 'url';
import { inspect } from 'util';

// Thirdparty
import * as _ from 'lodash';
import * as BBPromise from 'bluebird';
import * as optional from 'optional-js';

// Local
import * as almError from '../core/almError';
import * as Force from '../core/force';
import messages = require('../messages');
import srcDevUtil = require('../core/srcDevUtil');
import SettingsGenerator = require('./scratchOrgSettingsGenerator');
import { ensureString } from '@salesforce/ts-types';

/**
 * Returns the url to be used to authorize into the new scratch org
 * @param scratchOrgInfoComplete
 * @param force
 * @param useLoginUrl
 * @returns {*}
 * @private
 */
const _getOrgInstanceAuthority = function(scratchOrgInfoComplete, appConfig, useLoginUrl, masterOrgLoginUrl) {
  const createdOrgInstance = scratchOrgInfoComplete.SignupInstance;

  let signupTargetLoginUrl;

  if (createdOrgInstance === 'utf8') {
    signupTargetLoginUrl = masterOrgLoginUrl;
  } else {
    const signupTargetLoginUrlConfig = appConfig.signupTargetLoginUrl;

    signupTargetLoginUrl = optional
      .ofNullable(signupTargetLoginUrlConfig)
      .orElse(`https://${createdOrgInstance}.salesforce.com`);
  }

  return signupTargetLoginUrl;
};

/**
 * after we successfully signup an org we need to trade the auth token for access and refresh token.
 * @param scratchOrgInfoComplete - The completed ScratchOrgInfo which should contain an access token.
 * @param force - the force api
 * @param hubOrg - the environment hub org
 * @param scratchOrg - the scratch org to save to disk
 * @param clientSecret - The OAuth client secret. May be null for JWT OAuth flow.
 * @param saveAsDefault {boolean} - whether to save this org as the default for this workspace.
 * @returns {*}
 * @private
 */
const _authorize = function(scratchOrgInfoComplete, force, hubOrg, scratchOrg, clientSecret, saveAsDefault, logger) {
  logger.debug(`_authorize - scratchOrgInfoComplete: ${JSON.stringify(scratchOrgInfoComplete, null, 4)}`);
  const appConfig = force.config.getAppConfigIfInWorkspace();
  const oauthConfig: AuthFields & {
    redirectUri?: string;
    privateKeyFile?: string;
    expirationDate?: string;
  } = {
    clientId: scratchOrgInfoComplete.ConnectedAppConsumerKey,
    createdOrgInstance: scratchOrgInfoComplete.SignupInstance
  };

  return hubOrg
    .getConfig()
    .then(configData => {
      configData.isDevHub = true;
      return hubOrg.saveConfig(configData);
    })
    .then(config => {
      const isJwtFlow = !!config.privateKey;
      oauthConfig.loginUrl = _getOrgInstanceAuthority(scratchOrgInfoComplete, appConfig, true, config.loginUrl);

      logger.debug(`_authorize - isJwtFlow: ${isJwtFlow}`);

      if (isJwtFlow && !process.env.SFDX_CLIENT_SECRET) {
        oauthConfig.username = scratchOrgInfoComplete.SignupUsername;
        oauthConfig.privateKeyFile = config.privateKey;
      } else {
        // Web Server OAuth "auth code exchange" flow
        if (process.env.SFDX_CLIENT_SECRET) {
          oauthConfig.clientSecret = process.env.SFDX_CLIENT_SECRET;
        } else if (clientSecret) {
          oauthConfig.clientSecret = clientSecret;
        }
        oauthConfig.redirectUri = scratchOrg.config.getOauthCallbackUrl();
        oauthConfig.authCode = scratchOrgInfoComplete.AuthCode;
      }

      oauthConfig.devHubUsername = config.username;
      oauthConfig.created = Date.now() + '';
      oauthConfig.expirationDate = scratchOrgInfoComplete.ExpirationDate;

      logger.debug(`_authorize - oauthConfig: ${JSON.stringify(oauthConfig, null, 4)}`);

      return force
        .authorizeAndSave(oauthConfig, scratchOrg, saveAsDefault)
        .then(orgConfig => {
          logger.debug(`_authorize - orgConfig.loginUrl: ${orgConfig.loginUrl}`);
          logger.debug(`_authorize - orgConfig.instanceUrl: ${orgConfig.instanceUrl}`);
          if (scratchOrgInfoComplete.Snapshot) {
            // save snapshot w/ org config data
            return scratchOrg.getConfig().then(decryptedConfig => {
              decryptedConfig.snapshot = scratchOrgInfoComplete.Snapshot;
              return scratchOrg.saveConfig(decryptedConfig).then(orgConfigData => {
                logger.debug(`_authorize - updated orgConfig: ${inspect(orgConfigData)}`);
                return orgConfigData;
              });
            });
          }
          return orgConfig;
        })
        .catch(err => {
          // If the custom domain url is not yet available,
          // the authorization above will fail. If this is the source of the error,
          // then retry the authorization using the instance url
          logger.debug(`err: ${JSON.stringify(err, null, 4)}`);
          if (err.code === 'ENOTFOUND') {
            oauthConfig.loginUrl = _getOrgInstanceAuthority(scratchOrgInfoComplete, appConfig, false, config.loginUrl);
            return force.authorizeAndSave(oauthConfig, scratchOrg, saveAsDefault);
          } else {
            return BBPromise.reject(err);
          }
        });
    });
};

/**
 * Signup API object.
 * @constructor
 * @param configApi The app configuration
 * @param forceApi The force api
 * the scratchOrgInfo status is active.
 */
const signup = function(forceApi?, hubOrg?) {
  this.force = optional.ofNullable(forceApi).orElse(new Force());
  this.hubOrg = hubOrg;

  this.orgSettings = new SettingsGenerator();
};

signup.checkOrgDoesntExists = async function(_scratchOrgInfo: any): Promise<void> {
  const usernameKey = Object.keys(_scratchOrgInfo).find((key: string) =>
    key ? 'USERNAME' === key.toUpperCase() : false
  );
  if (!usernameKey) {
    return;
  }

  const username = ensureString(_.get(_scratchOrgInfo, usernameKey));

  if (username && username.length > 0) {
    try {
      await AuthInfo.create({ username: username.toLowerCase() });
    } catch (e) {
      // if an AuthInfo couldn't be created that means no AuthFile exists.
      if (e.name === 'NamedOrgNotFound') {
        return;
      }
      // Something unexpected
      throw e;
    }
    // An org file already exists
    throw almError({ keyName: 'C-1007', bundle: 'signup' });
  }
};

/**
 * This extracts orgPrefs/settings from the user input and performs a basic scratchOrgInfo request.
 * @param scratchOrgInfo - An object containing the fields of the ScratchOrgInfo.
 * @returns {*|promise}
 */
signup.prototype.request = async function(scratchOrgInfo) {
  //Look for any settings
  await this.orgSettings.extract(scratchOrgInfo);

  // If these were present, they were already used to initialize the scratchOrgSettingsGenerator.
  // They shouldn't be submitted as part of the scratchOrgInfo.
  delete scratchOrgInfo.settings;
  delete scratchOrgInfo.objectSettings;

  // We do not allow you to specify the old and the new way of doing post create settings
  if (scratchOrgInfo.orgPreferences && this.orgSettings.hasSettings()) {
    // This is not allowed
    throw almError('signupDuplicateSettingsSpecified');
  }

  //See if we need to migrate and warn about using old style orgPreferences
  if (scratchOrgInfo.orgPreferences) {
    await this.orgSettings.migrate(scratchOrgInfo);
  }

  const _scratchOrgInfo = srcDevUtil.mapKeys(scratchOrgInfo, _.upperFirst, true);

  await signup.checkOrgDoesntExists(_scratchOrgInfo); // throw if it does exists.

  return Logger.child('scratchOrgInfoApi').then(logger => {
    this.logger = logger;
    return this.force.create(this.hubOrg, 'ScratchOrgInfo', _scratchOrgInfo).catch(err => {
      if (err.errorCode === 'REQUIRED_FIELD_MISSING') {
        err['message'] = messages(this.force.config.getLocale()).getMessage(
          'signupFieldsMissing',
          err.fields.toString()
        );
      }
      return BBPromise.reject(err);
    });
  });
};

/**
 * salesforce only allows soql queries that are 10K or less characters long. We want to isolate ScratchOrgInfo queries to locally
 * authenticated orgs. To do that we need to make sure jsforce doesn't submit a query that exceeds this limit. Which is
 * what could happen by calling retrieveScratchOrgInfosWhereInOrgIds with a criteria object such as
 * {ScratchOrg: {$in: [...]}}
 * @param {object} devHub - The devHub used to query ScratchOrgInfo objects.
 * @param {array} scratchOrgIds - List of org ids that will be chunked.
 * @param {number} chunkSize - The maximum number of ScratchOrgsIds to submit in one query.
 * @returns {BBPromise.<Map>} - See retrieveScratchOrgInfos
 */
signup.prototype.retrieveScratchOrgInfosWhereInOrgIds = function(devHub, scratchOrgIds, chunkSize = 100) {
  const maxChunkSize = _.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : 100;
  const maxNumberOfIds = 2000;

  if (scratchOrgIds) {
    if (scratchOrgIds.length > maxNumberOfIds) {
      return BBPromise.reject(almError('MaxOrgIds', [maxNumberOfIds], 'MaxOrgIdsAction'));
    }

    if (scratchOrgIds.length > maxChunkSize) {
      const chunks = _.chunk(scratchOrgIds, maxChunkSize);

      // Id list is chunked to ensure jsforce doesn't specify a query greater than 10K characters. And we won't submit more
      // than 1 request at a time.
      return BBPromise.map(chunks, chunk => this.retrieveScratchOrgInfos(devHub, { ScratchOrg: { $in: chunk } }), {
        concurrency: 1
      }).then(arrayOfMaps => _.reduce(arrayOfMaps, (accum, value) => new Map([...accum, ...value]), new Map()));
    } else {
      return this.retrieveScratchOrgInfos(devHub, {
        ScratchOrg: { $in: scratchOrgIds }
      });
    }
  }
  return BBPromise.resolve(new Map());
};

/**
 * retrieves a list of scratchOrgInfo's associated with a devHub
 * @param devHub - the dev hub associated with the infos.
 * @param {object} criteria - the query criteria. ex {Id: '1234233214'}
 * @param {array} fields - the fields expected for the return
 * @returns {BBPromise.<Map>} keys = SignupUsername, values = org data
 */
signup.prototype.retrieveScratchOrgInfos = function(devHub, criteria, fields) {
  // By default we will find all
  let _criteria = {};

  // make sure devHub is defined
  if (!_.isNil(devHub)) {
    // if criteria is specified
    if (!_.isNil(criteria)) {
      // And it's and object
      if (_.isObject(criteria) && !_.isEmpty(criteria)) {
        _criteria = criteria;
      } else {
        const error = new Error(`criteria must be an object: ${criteria}`);
        error['name'] = 'InvalidCriteria';
        return BBPromise.reject(error);
      }
    }

    // default criteria
    let _fields = ['OrgName', 'Status', 'CreatedBy.Username', 'CreatedDate', 'ExpirationDate', 'Edition'];

    // if fields are specified
    if (!_.isNil(fields)) {
      // And it's an array of non-empty strings
      if (_.isArray(fields) && fields.length > 0 && fields.every(elem => _.isString(elem) && elem.length > 0)) {
        _fields = fields;
      } else {
        const error = new Error(`fields must be an array: ${criteria}`);
        error['name'] = 'InvalidFields';
        return BBPromise.reject(error);
      }
    }

    const returnKey = 'SignupUsername';

    // Ensure the fields includes the ScratchOrgId
    if (!_fields.includes(returnKey)) {
      _fields.push(returnKey);
    }

    // Go to the server and get all the scratch orgs for the specified dev hub.
    // Return a map keyed by SignupUsername
    return devHub.getConfig().then(orgConfig =>
      this.force.find(devHub, 'ScratchOrgInfo', _criteria, _fields).then(data => {
        // convert head up camel case to head down camel case
        const info = data.map(element => {
          const orgElement = _.mapKeys(element, (val, key) => _.camelCase(key));
          orgElement.devHubOrgId = orgConfig.orgId;
          // Store the dev hub reference since we have it and it's potentially expensive to get.
          orgElement.devHubUsername = orgConfig.username;
          if (_.isPlainObject(orgElement.createdBy)) {
            orgElement.createdBy = orgElement.createdBy.Username;
          }
          return orgElement;
        });

        // index the scratch org infos by signupUsername
        return new Map(info.map(element => [element[_.camelCase(returnKey)], element]));
      })
    );
  } else {
    const error = new Error('provide a devHub when finding scratchOrgInfo objects');
    error['name'] = 'NoDevHub';
    return BBPromise.reject(error);
  }
};

/**
 * This retrieves the ScratchOrgInfo
 * @param scratchOrgInfoId - the id of the scratchOrgInfo that we are retrieving
 * @returns {BBPromise}
 */
signup.prototype.retrieveScratchOrgInfo = async function(scratchOrgInfoId) {
  const request = await this.force.retrieve(this.hubOrg, 'ScratchOrgInfo', scratchOrgInfoId);

  if (!this.logger) {
    this.logger = await Logger.child('scratchOrgInfoApi');
  }
  this.logger.debug(`retrieveScratchOrgInfo status: ${request.Status}`);

  let message;
  let error;
  switch (request.Status) {
    case 'Active':
      return request;
    case 'Error':
      if (request.ErrorCode) {
        message = messages().getMessage('signupFailed', request.ErrorCode);
      } else {
        // Maybe the request object can help the user somehow
        this.logger.error('No error code on signup error! Logging request.');
        this.logger.error(request);

        message = messages().getMessage('signupFailedUnknown', [request.Id, this.hubOrg.getName()]);
      }
      error = new SfdxError(message, 'RemoteOrgSignupFailed');
      break;
    default:
      message = messages().getMessage('signupUnexpected');
      error = new SfdxError(message, 'UnexpectedSignupStatus');
  }

  throw error;
};

/**
 * This authenticates into the newly created org and sets org preferences
 * @param scratchOrgInfoResult - an object containing the fields of the ScratchOrgInfo
 * @param clientSecret - the OAuth client secret. May be null for JWT OAuth flow
 * @param scratchOrg - The ScratchOrg configuration
 * @param saveAsDefault - Save the org as the default for commands to run against
 * @returns {*}
 */
signup.prototype.processScratchOrgInfoResult = function(scratchOrgInfoResult, clientSecret, scratchOrg, setAsDefault) {
  scratchOrg.setName(scratchOrgInfoResult.SignupUsername);

  return _authorize(
    scratchOrgInfoResult,
    this.force,
    this.hubOrg,
    scratchOrg,
    clientSecret,
    setAsDefault,
    this.logger
  ).then(orgData => {
    const resultingOrgData = orgData;

    const setPreferences = () => {
      if (this.orgSettings.hasSettings()) {
        return scratchOrg.applySettings(this.orgSettings, this.force.config.apiVersion);
      }
      return BBPromise.resolve(null);
    };

    // perform remote operations in parallel
    return BBPromise.all([
      // set desired prefs on org
      setPreferences(),
      // send creds for apphub access
      scratchOrg.getAppHub().then(appHubApi => appHubApi.postScratchOrgCreate(scratchOrgInfoResult, scratchOrg))
    ])
      .then(() => resultingOrgData)
      .then(() => {
        this.logger.debug(
          `processScratchOrgInfoResult - scratchOrgInfoResult.LoginUrl: ${scratchOrgInfoResult.LoginUrl}`
        );
        if (scratchOrgInfoResult.LoginUrl) {
          return scratchOrg.getConfig().then(config => {
            config.instanceUrl = scratchOrgInfoResult.LoginUrl;
            config.expirationDate = scratchOrgInfoResult.ExpirationDate;
            return scratchOrg.saveConfig(config);
          });
        }
        return resultingOrgData;
      })
      .then(resultData => {
        if (resultData.instanceUrl) {
          this.logger.debug(
            `processScratchOrgInfoResult - resultData.instanceUrl: ${JSON.stringify(resultData.instanceUrl)}`
          );
          const options = {
            timeout: Duration.minutes(3),
            frequency: Duration.seconds(10),
            url: new URL(resultData.instanceUrl)
          };
          return MyDomainResolver.create(options)
            .then(resolver =>
              resolver.resolve().catch(err => {
                this.logger.debug(`processScratchOrgInfoResult - err: ${JSON.stringify(err, null, 4)}`);
                if (err.name === 'MyDomainResolverTimeoutError') {
                  err.setData({
                    orgId: resultData.orgId,
                    username: resultData.username,
                    instanceUrl: resultData.instanceUrl
                  });
                  this.logger.debug(`processScratchOrgInfoResult - err data: ${JSON.stringify(err.data, null, 4)}`);
                }
                throw err;
              })
            )
            .then(() => resultData);
        }
        return resultData;
      })
      .catch(err => BBPromise.reject(err));
  });
};

export = signup;

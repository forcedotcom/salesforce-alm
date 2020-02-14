/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Dictionary } from '@salesforce/ts-types';

// Node
import * as url from 'url';
import * as _ from 'lodash';

// Thirdparty
import * as BBPromise from 'bluebird';

const fs = BBPromise.promisifyAll(require('fs'));
import cli from 'cli-ux';

// Local
import Org = require('../core/scratchOrgApi');
import Alias = require('../core/alias');

import messages = require('../messages');
import * as almError from '../core/almError';
import srcDevUtil = require('../core/srcDevUtil');
import consts = require('../core/constants');
import { Config as ConfigApi } from '../core/configApi';

import { ConfigAggregator } from '@salesforce/core';
import { startOauth, OauthListenerConfig } from './webAuthListener';

const defaultConnectedAppInfo = require('../core/defaultConnectedApp');
const urls = require('../urls');

const getType = context => {
  let type;
  if (context.setdefaultusername) {
    type = Org.Defaults.USERNAME;
  } else if (context.setdefaultdevhubusername) {
    type = Org.Defaults.DEVHUB;
  }
  return type;
};

/**
 * function to prompt user in demo mode before saving auth file
 * @param username - the user being logged in to
 * @returns {BBPromise.<string>} - return the prompt or a resolved yes case
 */
const handleDemoModePrompt = function(username) {
  if (this.noprompt) {
    return BBPromise.resolve('y');
  } else {
    let promptMessage = messages().getMessage('warnAuth', username, 'demoMode');
    if (this.isWebLogin) {
      promptMessage += messages().getMessage('warnAuthWebLogin', [], 'demoMode');
    }
    promptMessage += messages().getMessage('warnAuthQuestion', [], 'demoMode');
    return cli.prompt(promptMessage);
  }
};

/**
 * stdin handler called when the client secret is obtained from the user.
 * @param force  - the force api.
 * @param clientSecret - the Oauth client secret.
 * @param context - the cli context.
 */
const doAuth = function(force, clientSecret, context, orgApi, loginUrl, open) {
  const oauthConfig: Dictionary<any> = {
    clientId: context.clientid,
    redirectUri: force.getConfig().getOauthCallbackUrl(),
    loginUrl
  };

  // Connected apps can allow no secret
  if (clientSecret) {
    oauthConfig.clientSecret = clientSecret;
  }

  context.isWebLogin = true;

  const authUrl = force.getAuthorizationUrl(oauthConfig);

  const authListenerConfig: OauthListenerConfig = {
    orgApi,
    oauthConfig: {
      clientId: oauthConfig.clientId,
      redirectUri: oauthConfig.redirectUri,
      loginUrl: oauthConfig.loginUrl,
      clientSecret: oauthConfig.clientSecret
    },
    validateState: requestState => {
      const query = url.parse(authUrl, true).query;

      return !_.isNil(requestState) && requestState === query.state;
    },
    type: getType(context),
    handleDemoModePrompt: handleDemoModePrompt.bind(context)
  };

  return (
    startOauth(authListenerConfig)
      // We want to open the browser after we start the oauth server in case
      // there is a problem starting the oauth server.
      .then(({ oauthResponse }) => open(authUrl, { wait: false }).then(() => oauthResponse))
      .then(() => orgApi.getConfig())
  );
};

const AUTH_URL_REGEXP = /^force:\/\/(?:([^:]*):([^:]*):)?([^@:]*)@([\w@:/\-.]*)$/;

const _doSfdxUrlAuth = function(force, context, orgApi) {
  const type = getType(context);

  const file = context.sfdxurlfile;

  return srcDevUtil
    .readJSON(file)
    .catch(() => fs.readFileAsync(file, 'utf8').then(sfdxAuthUrl => ({ sfdxAuthUrl })))
    .then(({ sfdxAuthUrl }) => {
      const matcher = _.isString(sfdxAuthUrl) && sfdxAuthUrl.trim().match(AUTH_URL_REGEXP);

      if (!matcher) {
        throw almError({ keyName: 'InvalidSfdxAuthUrl', bundle: 'auth_sfdxurl' }, [
          consts.AUTH_URL_FORMAT1,
          consts.AUTH_URL_FORMAT2
        ]);
      }

      // We have 4 possible vars specified in the format. clientId, clientSecret, refreshToken, instanceUrl
      const NUM_VARS = 4;
      const variables = [];
      let matcherIndex = matcher.length - 1;
      let variableIndex = NUM_VARS - 1;

      // Start from the back of the matcher, and move backwards since some variables are optional
      while (variableIndex >= 0) {
        if (matcherIndex > 0) {
          variables.push(matcher[matcherIndex]);
        } else {
          variables.push(undefined);
        }
        variableIndex--;
        matcherIndex--;
      }

      const [tmpInstanceUrl, refreshToken, clientSecret, clientId] = variables;

      // ensure url has https (add-on may or may not supply it)
      const instanceUrl = !tmpInstanceUrl.startsWith('http') ? `https://${tmpInstanceUrl}` : tmpInstanceUrl;

      return force.authorizeAndSave(
        {
          instanceUrl,
          loginUrl: instanceUrl,
          refreshToken,
          clientSecret,
          clientId: clientId ? clientId : defaultConnectedAppInfo.clientId
        },
        orgApi,
        !!type,
        handleDemoModePrompt.bind(context)
      );
    });
};

const _doJwtAuth = function(force, context, orgApi, loginUrl) {
  const type = getType(context);

  const oauthConfig = {
    clientId: context.clientid,
    loginUrl,
    username: context.username,
    privateKeyFile: context.jwtkeyfile
  };

  return force.authorizeAndSave(oauthConfig, orgApi, !!type, handleDemoModePrompt.bind(context));
};

const _handleNoLoginErr = function(err) {
  if (err.name === 'AuthNotSaved') {
    return err;
  }
  throw err;
};

/**
 * module interface for the authorization command
 * @param force - reference to the force implementation
 * @constructor
 */
class AuthCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor(force?) {
    const Force = require('../core/force'); // eslint-disable-line global-require

    this.force = _.isNil(force) ? new Force(new ConfigApi()) : force;
    this.force.generateCodeChallenge();
    this.messages = messages(this.force.config.getLocale());
  }

  /**
   * main processing for the command. other commands should implement a similar prototype
   * @param context - the cli context (flags)
   * @param stdinValues - map of stdin values
   * @returns {BBPromise.<Error>}
   */
  async execute(context, stdinValues?) {
    this.isJwt = !_.isNil(context.jwtkeyfile);
    this.isSfdxUrl = !_.isNil(context.sfdxurlfile);

    let authConfig;
    let org = new Org(this.force, getType(context));
    org.alias = context.setalias;

    /*
     * We are assuming that if a username is present then we are using JWT.
     * With a username we can then see if a previous authorization already exists.
     * If one does, we will tell the user to log off first.
     * We don't want to overwrite an existing auth file if one already exists
     * because we may lose some properties.
     */
    try {
      if (context.username) {
        org.setName(context.username);
        authConfig = await org.getConfig(); // Check to see if there is already a config file.

        /* If the user already has a valid config file in place
         * then we want to notify them that they need to run
         * sfdx force:auth:logout to remove the existing authorization.
         */

        // Also Gotta read the auth file directly so the return auth token is encrypted
        return srcDevUtil.getGlobalConfig(`${authConfig.username}.json`);
      } else {
        return AuthCommand.doNewAuth(org, context, this.isJwt, this.isSfdxUrl, this.force, stdinValues);
      }
    } catch (error) {
      if (error.name === 'NoOrgFound' || error.name === 'AuthNotSaved') {
        return AuthCommand.doNewAuth(org, context, this.isJwt, this.isSfdxUrl, this.force, stdinValues);
      } else {
        throw error;
      }
    }
  }

  /**
   * This method will be used when new authentication is needed.
   * @param org - orgApi
   * @param context - the cli context (flags)
   * @param isJwt - authentication via JWT token
   * @param isSfdxUrl - authentication via web login
   * @param force - reference to the force implementation
   * @param stdinValues - map of stdin values
   * @returns {BBPromise.<Error>}
   */
  static doNewAuth = function(org: Org, context, isJwt, isSfdxUrl, force, stdinValues?) {
    let promise;
    if (context.instanceurl) {
      // Always use the command line instance first;
      promise = BBPromise.resolve(context.instanceurl);
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

    if (isSfdxUrl) {
      promise = promise.then(() => _doSfdxUrlAuth(force, context, org)).catch(err => _handleNoLoginErr(err));
    } else if (isJwt) {
      promise = promise
        .then(loginUrl => _doJwtAuth(force, context, org, loginUrl))
        .catch(err => _handleNoLoginErr(err));
    } else {
      let clientSecret;

      // use default global connected app
      if (_.isNil(context.clientid)) {
        context.clientid = defaultConnectedAppInfo.clientId;
      } else {
        clientSecret = _.isNil(stdinValues) ? null : stdinValues.get('secret');
      }
      // If the user gave an empty secret, pass in null
      clientSecret = clientSecret ? clientSecret.trim() : undefined;
      promise = promise.then(loginUrl =>
        doAuth(force, clientSecret, context, org, loginUrl, AuthCommand.getOpen()).catch(err => {
          if (err.name === 'invalid_client') {
            throw almError('invalid_client');
          } else if (err.name === 'AuthNotSaved') {
            return err;
          }
          throw err;
        })
      );
    }

    if (context.setalias) {
      promise = promise.then(res => Alias.set(context.setalias, res.username).then(() => res));
    }

    return promise;
  };

  static getOpen() {
    return require('opn'); // eslint-disable-line global-require
  }

  validate(context) {
    const username = context.flags.username;
    const file = context.flags.jwtkeyfile;

    if ((!_.isNil(username) && _.isNil(file)) || (_.isNil(username) && !_.isNil(file))) {
      const jwtError = new Error(this.messages.getMessage('authorizeCommandMissingJwtOption'));
      jwtError.name = 'AuthorizeCommandMissingJwtOption';
      return BBPromise.reject(jwtError);
    }

    if (_.isNil(context.flags.clientid) && !_.isNil(username) && !_.isNil(file)) {
      const missingClientIdError = new Error(this.messages.getMessage('authorizeCommandMissingClientId'));
      missingClientIdError.name = 'AuthorizeCommandMissingClientId';
      return BBPromise.reject(missingClientIdError);
    }

    return BBPromise.resolve(srcDevUtil.fixCliContext(context));
  }

  /**
   * returns a human readable message for a cli output
   * @param org - the data representing the authorized org
   * @returns {string}
   */
  getHumanSuccessMessage(resp) {
    if (resp.name === 'AuthNotSaved') {
      return resp.message ? resp.message : '';
    }

    let successMsg = this.messages.getMessage('authorizeCommandSuccess', [resp.username, resp.orgId]);
    if (!this.isJwt && !this.isSfdxUrl) {
      successMsg += `\n${this.messages.getMessage('authorizeCommandCloseBrowser')}`;
    }
    return successMsg;
  }
}

export = AuthCommand;

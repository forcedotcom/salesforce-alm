/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';
import { _Promise } from 'bluebird';
import * as almError from './core/almError';

const defaultConnectedApp = require('./core/defaultConnectedApp');
import Messages = require('./messages');
const messages = Messages();

const BUNDLE_NAME = 'IndexErrorProcessor';

/**
 * Simple enum so the error processors can returns something that indicates the check
 * completed and no problems were found.
 */
export enum CheckStatus {
  OK
}

/**
 * Returns an array of processors used to determine if an error can be further refined. Instead of
 * adding more error handing logic to index.js add it here, as it's much easier to unit test.
 * @param appConfig - the sfdx configuration
 * @param context - the cli context
 * @param err - a potentially course grained error thrown by the cli.
 */
export function getProcessors(appConfig, context, err): Array<_Promise> {
  return [
    checkVersionMisMatchAsync(context, err),
    checkServer500(err),
    checkOauthAnd404(appConfig, context, err),
    checkInvalidLoginUrlWithAccessToken(context, err)
  ];
}

/**
 * Check is there is an invalid grant with oauth or a 404 response from the server.
 * @param appConfig - sfdx configuration
 * @param context - cli context
 * @param err - an error from the cli
 */
export function checkOauthAnd404(appConfig, context, err): CheckStatus {
  if (context && err && (err.name === 'invalid_grant' || err.name === 'ERROR_HTTP_404')) {
    const notFoundMessage = messages.getMessage('notSpecified');
    let authConfig: any = {};
    if (context.org) {
      authConfig = context.org.authConfig;
    } else {
      _.set(authConfig, 'username', context.flags.username);
      _.set(authConfig, 'clientId', context.flags.clientid);
      _.set(authConfig, 'privateKey', context.flags.jwtkeyfile);
      if (appConfig) {
        _.set(authConfig, 'loginUrl', appConfig.sfdcLoginUrl);
      }
    }

    throw almError(
      'oauthInvalidGrant',
      [
        // We know the 404 and invalid grant error always contain a name and message.
        // The 404 error message is an html error page response.
        err.name.includes('404') ? err.name : `${err.name} - ${err.message}`,
        _.isNil(authConfig.username) ? notFoundMessage : authConfig.username,
        _.isNil(authConfig.clientId) || authConfig.clientId === defaultConnectedApp.legacyClientId
          ? notFoundMessage
          : authConfig.clientId,
        _.isNil(authConfig.loginUrl) ? notFoundMessage : authConfig.loginUrl,
        _.isNil(authConfig.privateKey) ? notFoundMessage : authConfig.privateKey
      ],
      'oauthInvalidGrantAction'
    );
  }
  return CheckStatus.OK;
}

/**
 * Check that the servers api version is <= to the local config apiVersion.
 * @param context - the cli context that contains an org
 * @param _err  - an error thrown by the cli
 */
export async function checkVersionMisMatchAsync(context, _err): Promise<CheckStatus> {
  if (_err && _err.name === 'NOT_FOUND') {
    if (context && context.org) {
      const maxApiVersionForOrg = await context.org.retrieveMaxApiVersion();
      const configVersion = context.org.force.config.getApiVersion();

      if (_.toNumber(configVersion) > _.toNumber(maxApiVersionForOrg.version)) {
        throw almError({ bundle: BUNDLE_NAME, keyName: 'apiMisMatch' }, [configVersion, maxApiVersionForOrg.version], {
          keyName: 'apiMisMatchAction',
          bundle: BUNDLE_NAME
        });
      }
    }
  }

  return CheckStatus.OK;
}

/**
 * Check to see if the throw error is a server 500. THis error is critical. If a database is being update in production
 * This error is throw after a rest style connection. It's imperative that customer's get a link to http://trust.salesforce.com
 * @param _err - an error to process thrown by the cli.
 */
export function checkServer500(_err): CheckStatus {
  if (_err && _err.name === 'ERROR_HTTP_500' && _.isEmpty(_.trim(_err.message))) {
    throw almError({ bundle: BUNDLE_NAME, keyName: 'server500' }, null, {
      bundle: BUNDLE_NAME,
      keyName: 'server500Action'
    });
  }
  return CheckStatus.OK;
}

export function checkInvalidLoginUrlWithAccessToken(context, err): CheckStatus {
  // provide action if instanceurl is incorrect
  if (
    context.org &&
    context.org.usingAccessToken &&
    (err.message.match(/Session expired or invalid/) || err.message.match(/Destination URL not reset/))
  ) {
    err['message'] = messages.getMessage('accessTokenLoginUrlNotSet', err.message);
    if (_.isNil(err.action)) {
      err['action'] = messages.getMessage('invalidInstanceUrlForAccessTokenAction');
    }
    throw err;
  }
  return CheckStatus.OK;
}

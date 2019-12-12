/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import * as almError from '../core/almError';
import { Logger } from '@salesforce/core';
import messages = require('../messages');

function _close(request) {
  request.connection.end();
  request.connection.destroy();
}

function _handleDemoMode(
  handleDemoModePrompt,
  authObject,
  force,
  oauthConfig,
  orgType,
  orgApi,
  trialExpirationDate,
  callback,
  demoModeError
) {
  return handleDemoModePrompt(authObject.username).then(answer => {
    // if the user approves the auth, save the auth data to the machine and return the callback
    if (answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y') {
      return force
        .saveOrgAuthData(force.logger, authObject, oauthConfig, false, orgType, orgApi, trialExpirationDate)
        .then(() => callback());
    }
    // otherwise update the error message telling the user to close the browser and return
    demoModeError.message = messages(force.config.getLocale()).getMessage('demoModeCloseBrowser', [], 'demoMode');
    return callback(demoModeError);
  });
}

function _getUrlAndRedirect(
  force,
  orgApi,
  response,
  callback,
  demoModeError?,
  oauthConfig?,
  handleDemoModePrompt?,
  orgType?
) {
  // Get the front door url for the scratch org
  return (
    force
      .getOrgFrontDoor(orgApi, false)
      // Reference the url for a follow redirect.
      .then(responseUrl => {
        response.redirect(303, responseUrl);
        response.end();
        if (demoModeError) {
          return _handleDemoMode(
            handleDemoModePrompt,
            demoModeError.authObject,
            force,
            oauthConfig,
            orgType,
            orgApi,
            demoModeError.trialExpirationDate,
            callback,
            demoModeError
          );
        } else {
          return callback();
        }
      })
  );
}

/**
 * Express request handler for the OauthRedirect. The OAuth redirect url configured in the Connected App must be
 * http://localhost:<port>/OauthRedirect
 * @param orgApi - The scratch org api.
 * @param oauthConfig - Object containing the necessary OAuth configuration parameters.
 * @param request - The http request.
 * @param response - The http response.
 * @param validateState - Callback for testing request forgeries.
 * @param callback - The callback invoked on err or success.
 */
const OauthRequestGet = function(
  orgApi,
  oauthConfig,
  request,
  response,
  validateState,
  callback,
  orgType,
  handleDemoModePrompt
) {
  const force = orgApi.force;

  const code = request.query.code;

  if (!validateState(request.query.state)) {
    const error = almError('urlStateMismatch');
    response.sendError(400, `${error.message}\n`);
    _close(request);
    return callback(error);
  } else {
    oauthConfig.authCode = code;

    return Logger.child('OauthRequestGet').then((logger: Logger) => {
      if (oauthConfig.authCode && oauthConfig.authCode.length > 4) {
        // AuthCodes are generally long strings. For security purposes we will just log the last 4 of the auth code.
        logger.debugCallback(() =>
          `Successfully obtained auth code: ...${oauthConfig.authCode.substring(oauthConfig.authCode.length - 5)}`);
      } else {
        logger.debug('Expected an auth code but couldn\'t find one.');
      }
      logger.debugCallback(() => `oauthConfig.loginUrl: ${oauthConfig.loginUrl}`);
      logger.debugCallback(() => `oauthConfig.clientId: ${oauthConfig.clientId}`);
      logger.debugCallback(() => `oauthConfig.redirectUri: ${oauthConfig.redirectUri}`);
      return force
        .authorizeAndSave(oauthConfig, orgApi, orgType)
        .then(() => {
          logger.debug(`Successfully traded the authcode for an access token.`);
          return _getUrlAndRedirect(force, orgApi, response, callback)
        })
        .catch(callbackOrError => {
          logger.debugCallback(() => `Error encountered - name: ${callbackOrError.name}`);
          if (callbackOrError.name === 'AuthNotSaved') {
            return _getUrlAndRedirect(
              force,
              orgApi,
              response,
              callback,
              callbackOrError,
              oauthConfig,
              handleDemoModePrompt,
              orgType
            );
          }
          return callback(callbackOrError);
        })
        .finally(() => {
          _close(request);
          logger.debug('closed');
        });
    });
  }
};

export = OauthRequestGet;

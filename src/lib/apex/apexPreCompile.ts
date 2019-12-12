/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';
import * as BBPromise from 'bluebird';
import logger = require('../core/logApi');
import * as url from 'url';

import * as almError from '../core/almError';
import consts = require('../core/constants');

const childLogger = logger.child('apexPreCompile');

/**
 * debug log lines.
 * @param {string||function} message - message to log
 * @private
 */
const _logDebug = function(message) {
  if (_.isFunction(message)) {
    childLogger.debug(message());
  } else {
    childLogger.debug(message);
  }
};

/**
 * checks the state of the apex cache
 * @param org - the target org
 * @returns {BBPromise} - the promised object contains the status attribute and can be one of 3 values.
 * {incomplete, complete, locked}
 * @private
 */
const _requestCurrentState = function(org) {
  return BBPromise.resolve(org.getConfig()).then(config => {
    const APEX_CACHE_STATE_URI = `/services/data/v${org.force.config.getApiVersion()}/tooling/apexCache`;
    const _url = url.resolve(config.instanceUrl, APEX_CACHE_STATE_URI);
    return org.force.request(org, 'GET', _url, {}).catch(err => {
      throw almError({ keyName: 'precompileQueryError', bundle: 'apexPreCompile' }, [err.message]);
    });
  });
};

/**
 * queues the compile action
 * @param org - the target org
 * @returns {BBPromise} - the promised compile response which could be several states. one of which is queued.
 * @private
 */
const _postCompile = function(org) {
  return BBPromise.resolve(org.getConfig()).then(config => {
    const APEX_CACHE_WARMER_URI = `/services/data/v${org.force.config.getApiVersion()}/tooling/apexCacheWarmer`;
    const _url = url.resolve(config.instanceUrl, APEX_CACHE_WARMER_URI);
    const headers = {
      'content-type': 'application/json'
    };
    return org.force.request(org, 'POST', _url, headers, JSON.stringify({ command: 'compile' })).catch(err => {
      throw almError({ keyName: 'precompileWarmerError', bundle: 'apexPreCompile' }, [err.message]);
    });
  });
};

/**
 * main entry point for the synchronous precompile
 * @returns {BBPromise} - this method is called recursively until it throws an error or completes successfully.
 * @private
 */
const _doPrecompile = function() {
  return _requestCurrentState(this.org).then(state => {
    _logDebug(() => `current state: ${JSON.stringify(state)}`);

    // compiling is done so just return
    if (state.status === 'complete') {
      return BBPromise.resolve(state);
    }
    // compiling state is incomplete so start a compile.
    else if (state.status === 'incomplete' && !this._compileInProgress) {
      return _postCompile(this.org).then(response => {
        _logDebug(() => `post compile status: ${JSON.stringify(response)}`);

        this._compileInProgress = true;
        return _doPrecompile.call(this);
      });
    }
    // status is likely locked because a compile is in progress. let's wait a bit then query again.
    else {
      return BBPromise.delay(this.pollInterval).then(_doPrecompile.bind(this));
    }
  });
};

const _DEFAULT_TIMEOUT = consts.DEFAULT_TIMEOUT.milliseconds;
const _DEFAULT_POLL_INTERVAL = 1000;

/**
 * Class to synchronously compile all Apex classes in an org.
 *
 * This feature can be disabled by setting the environment variable SFDX_PRECOMPILE_DISABLE=true
 */
class ApexCacheService {
  static DEFAULT_TIMEOUT = _DEFAULT_TIMEOUT;

  // TODO: proper property typing
  [property: string]: any;

  /**
   * constructor
   * @param {object} org - the target org
   * @param {number} timeout - the number of milliseconds to wait before the precompile times out.
   * @param {number} pollInterval - the number of milliseconds to wait before each query to the server for cache state.
   */
  constructor(org?, timeout = _DEFAULT_TIMEOUT, pollInterval = _DEFAULT_POLL_INTERVAL) {
    if (_.isNil(timeout) || !_.isNumber(timeout) || timeout < 0) {
      throw almError({ keyName: 'invalidTimeout', bundle: 'apexPreCompile' }, [_DEFAULT_POLL_INTERVAL]);
    }

    if (_.isNil(pollInterval) || !_.isNumber(pollInterval) || pollInterval < 0) {
      throw almError({ keyName: 'invalidPollInterval', bundle: 'apexPreCompile' }, [_DEFAULT_POLL_INTERVAL]);
    }

    if (_.isNil(org)) {
      throw almError({ keyName: 'missingOrg', bundle: 'apexPreCompile' }, []);
    }

    this.pollInterval = pollInterval;
    this.timeout = timeout;
    this.org = org;
    this.force = org.force;
    this._compileInProgress = false;
  }

  /**
   * this method delegates to the private _doCompile routine. this function maintains the overall timeout.
   */
  precompileSync() {
    if (!_.isNil(process.env.SFDX_PRECOMPILE_ENABLE) && process.env.SFDX_PRECOMPILE_ENABLE === 'true') {
      return _doPrecompile
        .call(this)
        .timeout(this.timeout)
        .catch(err => {
          if (err.name === 'TimeoutError') {
            throw almError(
              {
                keyName: 'precompileTimedOut',
                bundle: 'apexPreCompile'
              },
              [],
              { keyName: 'precompileTimedOutAction', bundle: 'apexPreCompile' }
            );
          }
          throw err;
        });
    } else {
      return BBPromise.resolve({ status: 'disabled' });
    }
  }
}

export = ApexCacheService;

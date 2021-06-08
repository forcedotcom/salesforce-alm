/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import { resolve } from 'url';
// Thirdparty
import * as Faye from 'sfdx-faye';
import * as BBPromise from 'bluebird';
import * as _ from 'lodash';

// Local
import * as almError from './almError';
import logger = require('./logApi');
import srcDevUtil = require('./srcDevUtil');
import consts = require('./constants');

// setTimeout takes a 32bit number. This is the highest it can be.
const MAX_TIMEOUT = 2147483647;

import { Env } from '@salesforce/kit';
import { Time } from './time';

/**
 * The is the stream listener for a container async result status.
 *
 * @param orgApi - The hubOrg.
 * @constructor
 */

class StreamClient {
  public static readonly SFDX_ENABLE_FAYE_COOKIES_ALLOW_ALL_PATHS = 'SFDX_ENABLE_FAYE_REQUEST_RESPONSE_LOGGING';
  public static readonly SFDX_ENABLE_FAYE_REQUEST_RESPONSE_LOGGING = 'SFDX_ENABLE_FAYE_REQUEST_RESPONSE_LOGGING';

  private orgApi;
  private client;
  private logger;
  private isHandshakeComplete;
  private shouldDisconnect;
  private _defaultWaitInMinutes;
  private _waitInMinutes;
  private timeout;
  private streamingImpl;
  private env: Env;

  constructor(orgApi, streamingImpl?) {
    this.orgApi = orgApi;
    this.client = undefined;
    this.logger = logger.child('status', {
      org: this.orgApi.getName(),
    });
    this.isHandshakeComplete = false;
    this.shouldDisconnect = false;
    this._defaultWaitInMinutes = consts.DEFAULT_STREAM_TIMEOUT_MINUTES;
    this._waitInMinutes = undefined;

    this.streamingImpl = _.isNil(streamingImpl) ? Faye : streamingImpl;
    this.env = new Env();
    this.streamingImpl.logger = (message) => {
      this.logger.debug(message);
    };
  }

  /**
   * Returns the specified waitInMinutes or the default
   *
   * @returns {*|*|number}
   */
  public getRuntimeWait() {
    return this.waitInMinutes || this.defaultWaitInMinutes;
  }

  /**
   * Return the "default" waitTimeout. This value is used if waitTimeout is not provided.
   *
   * @returns {number}
   */
  get defaultWaitInMinutes() {
    return this._defaultWaitInMinutes;
  }

  /**
   * sets the "default" waitTimeOut to use if no waitTimeout is provided.
   *
   * @param value {number} - value of the default timeout
   */
  set defaultWaitInMinutes(value) {
    this._defaultWaitInMinutes = StreamClient.validateWaitValue(value);
  }

  /**
   * Specifies a wait timeout to use. This trumps whatever is set for the default wait timeout.
   *
   * @returns {number}
   */
  get waitInMinutes() {
    return this._waitInMinutes;
  }

  /**
   * sets the waitTimeOut to use. Overrides the default
   *
   * @param value {number} - value of the default timeout
   */
  set waitInMinutes(value) {
    this.logger.debug(`Setting streaming timeout to: ${value}m or ${new Time(value).milliseconds}ms`);
    // If the value is null or undefined we will use the default. Validate anything else that comes in.
    this._waitInMinutes = StreamClient.validateWaitValue(value);
  }

  static validateWaitValue(value) {
    // toNumber returns 0 for null NaN for undefined..
    const _value = _.toNumber(value);

    // If the value is null or NaN we will use the default. Validate anything else that comes in.
    if (value == null || _.isNaN(_value)) {
      return consts.DEFAULT_STREAM_TIMEOUT_MINUTES;
    }

    if (_.isInteger(_value) && _value >= consts.MIN_STREAM_TIMEOUT_MINUTES) {
      return _value;
    } else {
      throw almError('waitParamValidValueError', [consts.MIN_STREAM_TIMEOUT_MINUTES]);
    }
  }

  subscribe(topic: string, callback: any, returnHandshakePromise?: boolean, timeoutInMillis?: number) {
    return this.orgApi
      .refreshAuth()
      .then(() => this.orgApi.getConfig())
      .then((orgData) => {
        const apiVersion = topic.startsWith('/systemTopic') ? '36.0' : this.orgApi.force.config.getApiVersion();

        if (!(parseFloat(apiVersion) > 0)) {
          throw almError('invalidApiVersion', [apiVersion]);
        }

        /**
         * The salesforce network infrastructure issues a cookie called sfdx-stream if it sees /cometd in the url.
         * Without this cookie request response streams will experience intermittent client session failures.
         *
         * The following cookies should be sent on a /meta/handshake
         *
         * "set-cookie": [
         *    "BrowserId=<ID>;Path=/;Domain=.salesforce.com;Expires=Sun, 13-Jan-2019 20:16:19 GMT;Max-Age=5184000",
         *    "t=<ID>;Path=/cometd/;HttpOnly",
         *    "BAYEUX_BROWSER=<ID>;Path=/cometd/;Secure",
         *    "sfdc-stream=<ID>; expires=Wed, 14-Nov-2018 23:16:19 GMT; path=/"
         * ],
         *
         * Enable SFDX_ENABLE_FAYE_REQUEST_RESPONSE_LOGGING to debug potential session problems and to verify cookie
         * exchanges.
         */
        const streamUrl = resolve(orgData.instanceUrl, `cometd/${apiVersion}`);
        this.logger.debug(`streamUrl: ${streamUrl}`);
        let retVal: any = streamUrl;
        let subscribeAccept;
        let subscribeReject;

        // Some may not want to continue until the handshake is completed
        if (returnHandshakePromise) {
          retVal = new BBPromise((accept, reject) => {
            subscribeAccept = accept;
            subscribeReject = reject;
          });
        }

        const x = this.env.getString(StreamClient.SFDX_ENABLE_FAYE_COOKIES_ALLOW_ALL_PATHS);

        this.client = new this.streamingImpl.Client(streamUrl, {
          // This parameter ensures all cookies regardless of path are included in subsequent requests. Otherwise
          // only cookies with the path "/" and "/cometd" are known to be included.
          // if SFDX_ENABLE_FAYE_COOKIES_ALLOW_ALL_PATHS is *not* set then default to true.
          cookiesAllowAllPaths:
            x === undefined ? true : this.env.getBoolean(StreamClient.SFDX_ENABLE_FAYE_COOKIES_ALLOW_ALL_PATHS),
          // WARNING - The allows request/response exchanges to be written to the log instance which includes
          // header and cookie information.
          enableRequestResponseLogging: this.env.getBoolean(StreamClient.SFDX_ENABLE_FAYE_REQUEST_RESPONSE_LOGGING),
        });

        let _t = new Time(this.getRuntimeWait()).milliseconds;

        if (timeoutInMillis) {
          _t = timeoutInMillis;
        }

        if (_t > MAX_TIMEOUT) {
          this.logger.debug(`The wait is too long. Using ${MAX_TIMEOUT} instead`);
          _t = MAX_TIMEOUT;
        }

        const _self = this;
        this.timeout = setTimeout(() => {
          _self.logger.debug(`The streaming timeout of ${_self._waitInMinutes}m limit has been reached aborting.`);
          _self.disconnect();
          callback({ errorName: consts.LISTENER_ABORTED_ERROR_NAME });
        }, _t);

        this.logger.debug(`Streaming timeout abort set to ${_t}`);

        this.client.setHeader('Authorization', `OAuth ${orgData.accessToken}`);

        _.forEach(srcDevUtil.getSfdxRequestHeaders(), (val, key) => this.client.setHeader(key, val));

        // @todo This handle should come from the proper api object. Syncup...
        this.client.subscribe(topic, callback);

        this.client.on('transport:up', () => {
          this.logger.debug('Listening for streaming state changes....');
        });

        this.client.on('transport:down', () => {
          this.logger.debug('Faye generated a transport:down event. Faye will try and recover.');
          if (returnHandshakePromise && subscribeAccept && !this.isHandshakeComplete) {
            subscribeReject(almError('subscriberHandshakeTimeout', [], 'subscriberHandshakeTimeoutAction'));
          }
        });
        let lastTime = Date.now();
        this.client.addExtension({
          incoming: (message, cb) => {
            this.logger.debug(`Streaming message ${message.channel} in ${Date.now() - lastTime}ms since last message`);
            lastTime = Date.now();

            if (message.channel === '/meta/handshake' && message.successful === true) {
              this.logger.debug('Handshake successful');

              this.isHandshakeComplete = true;

              if (returnHandshakePromise && subscribeAccept) {
                subscribeAccept();
              }
            }

            if (this.shouldDisconnect && this.isHandshakeComplete) {
              this.logger.debug('Streaming disconnecting...');
              this.client.disconnect();
              this.isHandshakeComplete = false;
            }
            cb(message);
          },
        });

        return retVal;
      });
  }

  disconnect() {
    if (!_.isNil(this.client) && this.isHandshakeComplete) {
      this.client.disconnect();
    }

    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.shouldDisconnect = true;
  }
}

export = StreamClient;

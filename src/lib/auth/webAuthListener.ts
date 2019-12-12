/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root  or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as http from 'http';
import { Socket } from 'net';
import { parse as parseUrl, URL } from 'url';
import { parse as parseQueryString } from 'querystring';

import { Logger, Messages, SfdxError } from '@salesforce/core';
import { set, toNumber } from '@salesforce/kit';
import { get } from '@salesforce/ts-types';
import { ServerResponse } from 'http';
import oauthGet = require('./oauthRequest');

// Local
const _DEFAULT_CLIENT_SOCKET_TIMEOUT = 20000;

const messages = Messages.loadMessages('salesforce-alm', 'webAuthListener');

/**
 * check and get the socket timeout form what was set in process.env.SFDX_HTTP_SOCKET_TIMEOUT
 * @returns {number} - represents the socket timeout in ms
 * @private
 */
const _getSocketTimeout = function() {
  const socketTimeout = toNumber(process.env.SFDX_HTTP_SOCKET_TIMEOUT);
  return Number.isInteger(socketTimeout) && socketTimeout > 0 ? socketTimeout : _DEFAULT_CLIENT_SOCKET_TIMEOUT;
};

/**
 * Make sure we can't open a socket on the localhost/host port. It's important because we don't want to send
 * auth tokens to a random strange port listener. We want to make sure we can startup our server first.
 * @param port - default oauth callback port
 * @param host - hostname with localhost default
 * @private
 */
const _checkOsPort = async function(port: number, host = 'localhost') {
  return new Promise((resolve, reject) => {
    const clientConfig: any = { port, host };
    const socket = new Socket();

    socket.setTimeout(_getSocketTimeout(), () => {
      socket.destroy();
    });

    socket.connect(clientConfig, () => {
      socket.destroy();
      // This is just a private rejection error. startOauth rejects with an almError.
      const error = new SfdxError('Address in use', 'EADDRINUSE');
      error.data = {
        port: clientConfig.port,
        address: clientConfig.host
      };
      reject(error);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(port);
    });
  });
};

/**
 * sends a response redirect.
 * @param statusCode the statusCode for the response.
 * @param url the url to redirect to.
 * @param response the response to write the redirect to.
 */
function doRedirect(statusCode: number, url: string, response: ServerResponse) {
  response.setHeader('Content-Type', 'text/plain');
  const body = `${statusCode} - Redirecting to ${url}`;
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.writeHead(statusCode, { Location: url });
  response.end(body);
}

/**
 * sends a response error.
 * @param statusCode he statusCode for the response.
 * @param message the message for the http body.
 * @param response the response to write the error to.
 */
function sendError(statusCode: number, message: string, response: ServerResponse) {
  response.statusMessage = message;
  response.statusCode = statusCode;
  response.end();
}

/**
 * close all client sockets and server listener.
 * @param server the server listener to close
 * @param sockets an array of client sockets
 * @param logger
 */
function closeAll(server: http.Server, sockets: Socket[], logger: Logger) {
  sockets.forEach(socket => {
    socket.end();
    socket.destroy();
  });
  server.getConnections((err, num) => {
    logger.debug(`number of connections open: ${num}`);
  });
  server.close();
}

export interface OauthListenerConfig {
  orgApi: {
    config: {
      getOauthLocalPort: () => number;
    };
  };
  oauthConfig: {
    clientId: string;
    redirectUri: string;
    loginUrl: string;
    clientSecret: string;
  };
  validateState: (id: string) => boolean;
  type: string;
  handleDemoModePrompt: (username: string) => Promise<string>;
  server?: http.Server;
}

/**
 * main entry point for service
 */
export async function startOauth(listenerConfig: OauthListenerConfig): Promise<{ oauthResponse: Promise<any> }> {
  const logger = await Logger.child('webLogin');

  const port = listenerConfig.orgApi.config.getOauthLocalPort();
  try {
    await _checkOsPort(port);
    logger.debug(`Nothing listening on host: localhost port: ${port} - good!`);
    let _server: http.Server = listenerConfig.server || http.createServer();

    let sockets = [];
    _server.on('connection', socket => {
      logger.debug(`socket connection initialized from ${socket.remoteAddress}`);
      sockets.push(socket);
    });

    /*This promise is returned to the caller once the server starts listening. When this promise resolves the
     oauth redirect request is then processed by the caller via oauthGet.*/
    const oauthResponse = new Promise((resolve, reject) => {
      _server.on('request', (request, response) => {
        const url = parseUrl(request.url);

        logger.debug(`processing request for uri: ${url.pathname}`);

        if (request.method === 'GET') {
          if (url.pathname.startsWith('/OauthRedirect')) {
            request.query = parseQueryString(url.query);

            response.sendError = (code: number, message: string) => {
              return sendError(code, message, response);
            };

            response.redirect = (code: number, url: URL) => {
              logger.debug(`sending browser redirect response`);
              doRedirect(code, url.toString(), response);
            };

            logger.debug(`request.query.state: ${request.query.state}`);
            if (request.query.code && request.query.code.length > 4) {
              logger.debug(`request.query.code: ${request.query.code.substr(0, 4)} ....`);
            } // else let an auth failure handle the invalid code

            oauthGet(
              listenerConfig.orgApi,
              listenerConfig.oauthConfig,
              request,
              response,
              listenerConfig.validateState,
              err => {
                if (err) {
                  // We don't want to shutdown down the auth process if forged requests are sent.
                  // We gate the requests on a randomly generated expected value being returned from the
                  // oauth core login process.
                  if (err.name !== 'urlStateMismatch') {
                    reject(err);
                  } else {
                    logger.warn('urlStateMismatchAttempt detected.');
                    if (!get(_server, 'urlStateMismatchAttempt')) {
                      logger.error(err.message);
                      set(_server, 'urlStateMismatchAttempt', true);
                    }
                  }
                } else {
                  resolve();
                }
              },
              listenerConfig.type,
              listenerConfig.handleDemoModePrompt
            );
          } else {
            sendError(404, 'Resource not found', response);
            reject(SfdxError.create('salesforce-alm', 'webAuth', 'invalidRequestUri', [url.pathname]));
          }
        } else {
          sendError(405, 'Unsupported http methods', response);
          reject(SfdxError.create('salesforce-alm', 'webAuth', 'invalidRequestMethod', [request.method]));
        }
      });
    })
      .then(() => {
        logger.debug('closing server connection');
        closeAll(_server, sockets, logger);
      })
      .catch(err => {
        logger.debug('error reported, closing server connection and re-throwing');
        closeAll(_server, sockets, logger);
        throw err;
      });

    return new Promise(resolve => {
      _server.listen(port, 'localhost');
      _server.once('listening', () => {
        logger.debug(`OAuth web login service listening on port: ${port}`);
        resolve({ oauthResponse });
      });
    });
  } catch (err) {
    if (err.name === 'EADDRINUSE') {
      const error = SfdxError.create('salesforce-alm', 'webAuthListener', 'PortInUse', ['PortInUseAction']);
      error.actions = [messages.getMessage('PortInUseAction', [port])];
      throw error;
    } else {
      throw err;
    }
  }
}

export function getSocketTimeout() {
  return _getSocketTimeout();
}

export const DEFAULT_CLIENT_SOCKET_TIMEOUT = _DEFAULT_CLIENT_SOCKET_TIMEOUT;

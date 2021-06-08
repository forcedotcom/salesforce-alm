/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';

// Thirdparty
import * as _ from 'lodash';
import * as BBPromise from 'bluebird';

const dns = BBPromise.promisifyAll(require('dns'));

import * as openBrowser from 'open';

// Local
import Messages = require('../messages');
const messages = Messages();
import * as almError from '../core/almError';
import srcDevUtil = require('../core/srcDevUtil');

const SETUP = '/setup/forcecomHomepage.apexp';

/**
 * gets a url for the workspace or test org
 *
 * @param context - the cli context
 * @param force - the force api
 * @param orgApi - an org.
 * @returns {BBPromise}
 * @private
 */
const _getUrl = function (context, orgApi) {
  return orgApi.force.getOrgFrontDoor(orgApi).then((url) => {
    let newUrl = url;

    // if provided, redirect to url path post-login
    if (!util.isNullOrUndefined(context)) {
      if (!util.isNullOrUndefined(context.path)) {
        newUrl = `${url}&retURL=${encodeURIComponent(decodeURIComponent(context.path))}`;
      } else if (!util.isNullOrUndefined(context.setup)) {
        newUrl = `${url}&retURL=${SETUP}`;
      } else if (process.env.FORCE_OPEN_URL) {
        // allow default url to be specified by env
        newUrl = `${url}&retURL=${process.env.FORCE_OPEN_URL}`;
      }
    }

    return BBPromise.resolve(newUrl);
  });
};

// Try for four minutes, by default
const getDomainRetries = () =>
  _.isNil(process.env.SFDX_DOMAIN_RETRY) ? 240 : _.toInteger(process.env.SFDX_DOMAIN_RETRY);

const _checkLightningDomain = (myDomain, logger, retryCount = 0) =>
  dns
    .lookupAsync(`${myDomain}.lightning.force.com`)
    .then((ip) => {
      if (retryCount !== 0) {
        logger.logRaw(logger.getEOL() + logger.getEOL());
      }
      return ip;
    })
    .catch((err) => {
      if (retryCount >= getDomainRetries()) {
        logger.logRaw(logger.getEOL() + logger.getEOL());
        return BBPromise.reject(err);
      } else {
        if (retryCount === 0) {
          logger.logRaw(messages.getMessage('openCommandDomainWaiting'));
        } else if (retryCount % 15 === 0) {
          logger.logRaw('.');
        }
        return BBPromise.delay(1000).then(() => _checkLightningDomain(myDomain, logger, ++retryCount));
      }
    });

/**
 * either open user's desktop browser or just print the url in console.
 *
 * @param context - the cli context
 * @param force - the force api
 * @returns {BBPromise}
 * @private
 */
const _open = function (context, orgApi) {
  return _getUrl(context, orgApi).then((url) => {
    const orgData = orgApi.getConfig().then(({ orgId, username }) => BBPromise.resolve({ url, orgId, username }));
    const act = () => (context.urlonly ? orgData : openBrowser(url, { wait: false }).then(() => orgData));

    if (getDomainRetries() === 0 || srcDevUtil.isInternalUrl(url)) {
      return act();
    }

    try {
      const myDomain = url.match(/https?\:\/\/([^.]*)/)[1];
      return _checkLightningDomain(myDomain, orgApi.logger)
        .then(() => act())
        .catch(() =>
          orgData.then(() => {
            throw almError('openCommandDomainTimeoutError', null, 'openCommandDomainTimeoutAction');
          })
        );
    } catch (err) {
      // Error extracting the mydomain, just return.
      return act();
    }
  });
};

/**
 * recursive method to filter out the session id out of the log message/object/error
 *
 * @param args - the params to log
 * @returns {Array}
 * @private
 */
const _filter = function (...args) {
  return args.map((arg) => {
    if (util.isArray(arg)) {
      return _filter(...arg);
    } else if (util.isString(arg)) {
      return arg.replace(/sid=(.*)/, 'sid=<HIDDEN>');
    } else if (arg instanceof Error) {
      arg.message = _filter(arg.message)[0];
      return arg;
    } else if (util.isObject(arg)) {
      Object.keys(arg).forEach((key) => {
        arg[key] = _filter(arg[key])[0];
      });
      return arg;
    } else {
      return arg;
    }
  });
};

/**
 * provides the user a mechanism to open a force url for display in the console or as an address in the web browser.
 */
class OrgOpenCommand {
  private org;

  /**
   * executes the open command
   *
   * @param context - the cli context
   * @returns {BBPromise}
   */
  execute(context) {
    return _open(context, this.org);
  }

  /**
   * secondary validation for the cli.
   *
   * @param context - the cli context.
   * @returns {BBPromise}
   */
  validate(context) {
    this.org = context.org;
    this.org.force.logger.addFilter((...args) => _filter(...args));
    return BBPromise.resolve(srcDevUtil.fixCliContext(context));
  }

  /**
   * returns a success message that's human readable.
   *
   * @param urlObject - the json object returned from execute.
   * @returns {string}
   */
  getHumanSuccessMessage(urlObject) {
    return messages.getMessage('openCommandHumanSuccess', [urlObject.orgId, urlObject.username, urlObject.url]);
  }
}

export = OrgOpenCommand;

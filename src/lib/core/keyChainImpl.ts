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

import * as path from 'path';
import * as fs from 'fs';
import * as _ from 'lodash';

import * as almError from './almError';
import * as keychain from './keyChain';
import logApi = require('./logApi');
import srcDevUtil = require('./srcDevUtil');
import * as util from 'util';
import * as BBPromise from 'bluebird';

const logger = logApi.child('keyChainImpl');

const fsOpenPromise = util.promisify(fs.open);
let Org;

const _usingGenericKeychain = function() {
  const keyPath = path.join(srcDevUtil.getGlobalHiddenFolder(), 'key.json');
  logger.debug(`keyPath: ${keyPath}`);
  return fsOpenPromise(keyPath, 'r')
    .then(() => {
      logger.debug('keyPath found.');
      return true;
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        logger.debug('keyPath not found');
        return false;
      }
      logger.debug(err.message);
      throw err;
    });
};

export const DEPRECATED_KEYCHAIN = 'DEPRECATED_KEYCHAIN';

export const retrieveKeychainImpl = function(platform) {
  if (!Org) {
    Org = require('./scratchOrgApi'); // eslint-disable-line global-require
  }

  logger.debug(`platform: ${platform}`);

  const useGenericUnixKeychain = srcDevUtil.useGenericUnixKeychain();

  return BBPromise.all([_usingGenericKeychain(), Org.hasAuthentications()]).spread(
    (isUsingGenericKeychain, hasAuthentications) => {
      logger.debug(`isUsingGenericKeychain: ${isUsingGenericKeychain}`);
      logger.debug(`hasAuthentications: ${hasAuthentications}`);

      if (/^win/.test(platform)) {
        if (useGenericUnixKeychain) {
          return keychain.generic_windows;
        } else {
          if (!isUsingGenericKeychain && !hasAuthentications) {
            return keychain.generic_windows;
          }

          if (!isUsingGenericKeychain && hasAuthentications) {
            const error = new Error();
            error['name'] = DEPRECATED_KEYCHAIN;
            error['fromKeychain'] = keychain.windows;
            error['toKeychain'] = keychain.generic_windows;
            throw error;
          }

          return keychain.generic_windows;
        }
      } else if (/darwin/.test(platform)) {
        // OSX can use the generic keychain. This is useful when running under an
        // automation user.
        if (useGenericUnixKeychain) {
          return keychain.generic_unix;
        } else {
          return keychain.darwin;
        }
      } else if (/linux/.test(platform)) {
        // Use the generic keychain if specified
        if (useGenericUnixKeychain) {
          return keychain.generic_unix;
        } else {
          // otherwise try and use the builtin keychain
          try {
            keychain.linux.validateProgram();
            return keychain.linux;
          } catch (e) {
            // If the builtin keychain is not available use generic
            return keychain.generic_unix;
          }
        }
      } else {
        throw almError('UnsupportedOperatingSystem', [platform]);
      }
    }
  );
};

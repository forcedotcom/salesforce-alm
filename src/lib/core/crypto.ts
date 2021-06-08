/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
import * as os from 'os';
import * as crypto from 'crypto';
import * as _ from 'lodash';

// Thirdparty
import * as BBPromise from 'bluebird';

// Local
import * as almError from './almError';
import * as keyChainImpls from './keyChainImpl';
import logApi = require('./logApi');
import srcDevUtil = require('./srcDevUtil');
const { Messages } = require('@salesforce/core');
const logger = logApi.child('crypto');

const TAG_DELIMITER = ':';
const BYTE_COUNT_FOR_IV = 6;
const _algo = 'aes-256-gcm';
let _key = null;

const KEY_NAME = 'sfdx';
const ACCOUNT = 'local';

/**
 * osxKeyChain promise wrapper.
 *
 * @type {{get: KeychainPromises.get, set: KeychainPromises.set}}
 */
const KeychainPromises = {
  /**
   * Gets a password item
   *
   * @param service - The keychain service name
   * @param account - The keychain account name
   */
  get(_keychain, service, account) {
    return new BBPromise((resolve, reject) => {
      _keychain.getPassword({ service, account }, (err, password) => {
        if (err) {
          return reject(err);
        }
        return resolve({ username: account, password });
      });
    });
  },

  /**
   * Sets a generic password item in OSX keychain
   *
   * @param service - The keychain service name
   * @param account - The keychain account name
   * @param password - The password for the keychain item
   */
  set(_keychain, service, account, password) {
    return new BBPromise((resolve, reject) => {
      _keychain.setPassword({ service, account, password }, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve({ username: account, password });
      });
    });
  },

  /**
   * Move a keychain password from one keychain to another.
   *
   * @param oldKeychain - The keychin with the password
   * @param newKeychain - The target keychain
   * @param service - service name
   * @param account - account name
   */
  migrate(oldKeychain, newKeychain, service, account) {
    return KeychainPromises.get(oldKeychain, service, account).then((passwordResult) =>
      KeychainPromises.set(newKeychain, service, account, passwordResult.password)
    );
  },
};

/**
 * Crypto class for SFDX.
 *
 * @param packageDotJson - Override object for package.json properties. Used for unit testing.
 * @constructor
 */
class Crypto {
  // TODO: proper property typing
  [property: string]: any;

  constructor(_keychainImpls = keyChainImpls) {
    this.keychainImpls = _keychainImpls;

    logger.debug(`process.env.SFDX_DISABLE_ENCRYPTION: ${process.env.SFDX_DISABLE_ENCRYPTION}`);

    this.enableTokenEncryption = _.toUpper(process.env.SFDX_DISABLE_ENCRYPTION) !== 'TRUE';
  }

  /**
   * Initialize any crypto dependencies. In this case we need to generate an encryption key.
   *
   * @param retryStatus - A string message to track retries
   * @returns {*}
   */
  init(retryStatus?, platform = os.platform()) {
    logger.debug(`retryStatus: ${retryStatus}`);
    if (!this.enableTokenEncryption) {
      return BBPromise.resolve(null);
    }

    return this.keychainImpls
      .retrieveKeychainImpl(platform)
      .then((keychainImpl) => {
        logger.debug('keychain retrieved');
        return KeychainPromises.get(keychainImpl, KEY_NAME, ACCOUNT)
          .then((savedKey) => {
            logger.debug('password retrieved from keychain');

            _key = savedKey.password;

            // Just want to have something returned. But I do not want to return the encryption key.
            return 'ENCRYPTION_KEY_FOUND';
          })
          .catch((err) => {
            // No password found
            if (err.name === 'PasswordNotFound') {
              // If we already tried to create a new key then bail.
              if (retryStatus === 'KEY_SET') {
                logger.debug('a key was set but the retry to get the password failed.');
                throw err;
              } else {
                logger.debug('password not found in keychin attempting to created one and re-init.');
              }

              const key = crypto.randomBytes(Math.ceil(16)).toString('hex');
              // Create a new password in the KeyChain.
              return KeychainPromises.set(keychainImpl, KEY_NAME, ACCOUNT, key).then(() =>
                this.init('KEY_SET', platform)
              );
            } else {
              throw err;
            }
          });
      })
      .catch((err) => {
        if (retryStatus === 'MIGRATED') {
          logger.debug('The key was successfully migrated but an error occured getting the keychain on retry');
          throw err;
        }

        if (err.name === keyChainImpls.DEPRECATED_KEYCHAIN) {
          logger.debug('migrating key and trying again');
          return KeychainPromises.migrate(err.fromKeychain, err.toKeychain, KEY_NAME, ACCOUNT).then(() =>
            this.init('MIGRATED', platform)
          );
        }
        throw err;
      });
  }

  /**
   * Encrypts text.
   *
   * @param text - The text to encrypt.
   * @returns {undefined|String} - If enableTokenEncryption is set to false or not defined in package.json then the text
   * is simply returned unencrypted.
   */
  encrypt(text) {
    if (_.isNil(text)) {
      return undefined;
    }

    if (!this.enableTokenEncryption) {
      return text;
    }

    if (_.isNil(_key)) {
      throw new Error('Failed to create a password in the OSX keychain.');
    }

    const iv = crypto.randomBytes(BYTE_COUNT_FOR_IV).toString('hex');
    const cipher = crypto.createCipheriv(_algo, _key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');
    return `${iv}${encrypted}${TAG_DELIMITER}${tag}`;
  }

  /**
   * Decrypts text.
   *
   * @param text - The text to decrypt.
   * @returns {undefined|String} - If enableTokenEncryption is set to false or not defined in package.json then the text
   * is simply returned. The is then assumed to be unencrypted.
   */
  decrypt(text) {
    if (_.isNil(text)) {
      return undefined;
    }

    if (!this.enableTokenEncryption) {
      return text;
    }

    const tokens = text.split(TAG_DELIMITER);

    if (tokens.length !== 2) {
      throw almError('invalidEncryptedFormat', null, 'invalidEncryptedFormatAction', null);
    }

    const tag = tokens[1];
    const iv = tokens[0].substring(0, BYTE_COUNT_FOR_IV * 2);
    const secret = tokens[0].substring(BYTE_COUNT_FOR_IV * 2, tokens[0].length);

    const decipher = crypto.createDecipheriv(_algo, _key, iv);

    let dec;
    try {
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      dec = decipher.update(secret, 'hex', 'utf8');
      dec += decipher.final('utf8');
    } catch (e) {
      if (os.platform() === 'darwin' && !srcDevUtil.useGenericUnixKeychain()) {
        e.message += Messages.loadMessages('salesforce-alm', 'crypto').getMessage('MacKeychainOutOfSync');
      }
      throw almError('authDecryptFailed', [e.message]);
    }
    return dec;
  }

  close() {
    _key = null;
  }
}

export = Crypto;

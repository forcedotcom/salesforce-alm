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

import * as _ from 'lodash';

// Local
import ConfigFile = require('./ConfigFile');
import * as almError from '../core/almError';
import consts = require('../core/constants');
import Messages = require('../messages');
const messages = Messages();
import srcDevUtil = require('../core/srcDevUtil');
import Crypto = require('../core/crypto');

const SFDX_CONFIG_FILE_NAME = 'sfdx-config.json';

const OrgDefaults = {
  DEVHUB: consts.DEFAULT_DEV_HUB_USERNAME,
  USERNAME: consts.DEFAULT_USERNAME,

  list() {
    return [OrgDefaults.DEVHUB, OrgDefaults.USERNAME];
  }
};

// In the future consider keying input validation off of command type validation.
const ALLOWED_PROPERTIES = [
  {
    key: 'instanceUrl',
    input: {
      // If a value is provided validate it otherwise no value is unset.
      validator: value => _.isNil(value) || srcDevUtil.isSalesforceDomain(value),
      failedMessage: messages.getMessage('invalidInstanceUrl', null, 'sfdxConfig')
    }
  },
  {
    key: 'apiVersion',
    hidden: true,
    input: {
      // If a value is provided validate it otherwise no value is unset.
      validator: value => _.isNil(value) || /[1-9]\d\.0/.test(value),
      failedMessage: messages.getMessage('invalidApiVersion', null, 'sfdxConfig')
    }
  },
  { key: consts.DEFAULT_DEV_HUB_USERNAME },
  { key: consts.DEFAULT_USERNAME },
  {
    key: 'restDeploy',
    hidden: true,
    input: {
      validator: value => value.toString() === 'true' || value.toString() === 'false',
      failedMessage: messages.getMessage('invalidBooleanConfigValue')
    }
  },
  {
    key: 'isvDebuggerSid',
    encrypted: true
  },
  {
    key: 'isvDebuggerUrl'
  },
  {
    key: 'disableTelemetry',
    input: {
      validator: value => value.toString() === 'true' || value.toString() === 'false',
      failedMessage: messages.getMessage('invalidBooleanConfigValue')
    }
  }
];

const propertyConfigMap = _.keyBy(ALLOWED_PROPERTIES, 'key');

class SfdxConfig extends ConfigFile {
  static OrgDefaults = OrgDefaults;

  // TODO: proper property typing
  [property: string]: any;

  constructor(isGlobal?) {
    super(SFDX_CONFIG_FILE_NAME, isGlobal, true);
  }

  async initCrypto() {
    if (!this.crypto) {
      this.crypto = new Crypto();
      await this.crypto.init();
    }
  }

  clearCrypto() {
    if (this.crypto) {
      this.crypto.close();
      delete this.crypto;
    }
  }

  async cryptProperties(encrypt) {
    const hasEncryptedProperties = _.some(this.contents, (val, key) => !!this.getPropertyConfig(key).encrypted);

    // Only initialize crypto if there are properties that are encrypted.
    if (hasEncryptedProperties) {
      await this.initCrypto();

      _.each(this.contents, (value, key) => {
        if (this.getPropertyConfig(key).encrypted) {
          this.contents[key] = encrypt ? this.crypto.encrypt(value) : this.crypto.decrypt(value);
        }
      });
    }
  }

  async read() {
    try {
      await super.read();
      await this.cryptProperties(false);
    } finally {
      this.clearCrypto();
    }
    return Promise.resolve(this.contents);
  }

  async write() {
    try {
      // Encrypt the properties
      await this.cryptProperties(true);
      await super.write();
      // Decrypt after write so they can still be used
      await this.cryptProperties(false);
    } finally {
      this.clearCrypto();
    }
  }

  /**
   * Sync version of read.
   * @deprecated This should only be used by legacy config.
   */
  readSync() {
    try {
      this.contents = srcDevUtil.readJSONSync(this.path, false);
    } catch (err) {
      return this.checkEnoent(err);
    }
    return this.contents;
  }

  getPropertyConfig(propertyName) {
    const property = propertyConfigMap[propertyName];
    if (!property) {
      throw almError({ keyName: 'UnknownConfigKey', bundle: 'sfdxConfig' }, [propertyName]);
    }
    return property;
  }

  setPropertyValue(propertyName, value?) {
    const property = this.getPropertyConfig(propertyName);

    if (_.isNil(value)) {
      delete this.contents[propertyName];
    } else if (property.input) {
      if (property.input && property.input.validator(value)) {
        this.contents[property.key] = value;
      } else {
        throw almError({ keyName: 'invalidConfigValue', bundle: 'sfdxConfig' }, [property.input.failedMessage]);
      }
    } else {
      this.contents[property.key] = value;
    }
  }

  static getAllowedProperties() {
    return ALLOWED_PROPERTIES;
  }

  static async set(isGlobal, property, value?) {
    const config = new SfdxConfig(isGlobal);

    await config.read();
    config.setPropertyValue(property, value);
    return config.write();
  }

  static async clear() {
    // Clear the global config
    await new SfdxConfig(true).clear();
    // Then clear the local config
    await new SfdxConfig(false).clear();
  }
}

export = SfdxConfig;

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import VarargsCommand from '../core/varargsCommand';

// Thirdparty
import * as _ from 'lodash';

// Local
import Org = require('../core/scratchOrgApi');
import * as almError from '../core/almError';
import logApi = require('../core/logApi');
import SfdxConfig = require('./SfdxConfig');
import Messages = require('../messages');
const messages = Messages();

const VALID_CONFIG = {};
let CONFIG_ERROR_EXIT_CODE = 0;

function setSfdxConfig(key, value, isGlobal = false) {
  let config;
  try {
    config = new SfdxConfig(isGlobal);
  } catch (err) {
    if (err.name === 'InvalidProjectWorkspace') {
      err['message'] = `${err.message} ${messages.getMessage('globalHelp', [], 'configSetCommand')}`;
    }
    throw err;
  }

  return config
    .read()
    .then(() => {
      config.setPropertyValue(key, value);
    })
    .then(() => config.write());
}

function setOrgDefault(type, username, isGlobal) {
  if (_.isNil(username)) {
    return setSfdxConfig(type, username, isGlobal);
  } else {
    // Ensure the username exits by getting the config.
    return Org.create(username, type).then(() => setSfdxConfig(type, username, isGlobal));
  }
}

interface SuccessMsg {
  name: string;
  value: string;
}

interface FailureMsg {
  name: string;
  message: string;
}

// Org types are stored in sfdx-config.json, but set them separate here
// so we go through the org api to check if it is a valid username.
Org.Defaults.list().forEach(type => {
  VALID_CONFIG[type] = setOrgDefault;
});

SfdxConfig.getAllowedProperties().forEach(prop => {
  if (_.isNil(VALID_CONFIG[prop.key])) {
    VALID_CONFIG[prop.key] = setSfdxConfig;
  }
});

class SetCommand extends VarargsCommand {
  private successes: SuccessMsg[];
  private failures: FailureMsg[];

  constructor() {
    super('config:set');
    this.successes = [];
    this.failures = [];
  }

  async validate(context) {
    Object.keys(context.varargs).forEach(key => {
      if (!_.isFunction(VALID_CONFIG[key])) {
        throw almError({ keyName: 'UnknownConfigKey', bundle: 'sfdxConfig' }, [key]);
      }
    });
    return context;
  }

  async execute(context): Promise<any> {
    let promise = Promise.resolve();

    Object.keys(context.varargs).forEach(name => {
      const value = context.varargs[name];

      promise = promise
        .then(() => VALID_CONFIG[name](name, value, context.flags.global))
        .then(() => {
          this.successes.push({ name, value });
        })
        .catch(err => {
          CONFIG_ERROR_EXIT_CODE = 1;
          this.failures.push({ name, message: err.message });
        });
    });

    return promise.then(() => ({
      successes: this.successes,
      failures: this.failures
    }));
  }

  getHumanSuccessMessage() {
    const uiLogger = logApi.child(this.loggerName);
    if (this.successes.length > 0) {
      uiLogger.styledHeader(uiLogger.color.blue('Set Config'));
      uiLogger.table(this.successes, {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'value', label: 'Value' }
        ]
      });
    }

    if (this.failures.length > 0) {
      if (this.successes.length > 0) {
        uiLogger.log('');
      }

      uiLogger.styledHeader(uiLogger.color.red('Failures'));
      uiLogger.table(this.failures, {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'message', label: 'Message' }
        ]
      });
      process.exitCode = CONFIG_ERROR_EXIT_CODE;
    }

    return '';
  }
}

export = SetCommand;

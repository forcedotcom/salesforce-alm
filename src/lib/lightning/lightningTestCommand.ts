/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as BBPromise from 'bluebird';
import * as almError from '../core/almError';
import LightningTestApi = require('./lightningTestApi');
import * as _ from 'lodash';

class LightningTestCommand {
  // TODO: proper property typing
  [property: string]: any;

  validate(context) {
    this.org = context.org;
    const options = context.flags;
    return this.org.getConfig().then(config => {
      if (config.devHubUsername) {
        return BBPromise.resolve(options);
      }
      return BBPromise.reject(almError({ keyName: 'scratchOrgOnly', bundle: 'lightning_test' }, []));
    });
  }

  execute(context) {
    const testApi = new LightningTestApi(this.org);

    return testApi
      .initialize(context)
      .then(() => testApi.runTests())
      .then(res => {
        // If any tests failed, change the exit code to 100
        if (_.get(res, 'summary.failing')) {
          process.exitCode = 100;
        }
        return res;
      });
  }
}

export = LightningTestCommand;

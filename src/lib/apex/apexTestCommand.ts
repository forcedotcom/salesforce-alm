/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';
import * as BBPromise from 'bluebird';
import * as almError from '../core/almError';
import consts = require('../core/constants');
import logger = require('../core/logApi');
import messages = require('../messages');
import { Time } from '../core/time';
import { ApexTestApi } from '../apex/apexTestApi';
import ApexCacheService = require('../apex/apexPreCompile');

const _socketTimeoutHandler = function(message, api) {
  if (!_.isNil(api.testrunid)) {
    throw almError('genericTimeoutMessage', [], 'genericTimeoutCommandWaitMessageAction', [
      `force:apex:test:report -i ${api.testrunid}`
    ]);
  } else {
    throw almError('genericTimeoutMessage', [], 'genericTimeoutWaitMessageAction');
  }
};

class ApexTestCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('ApexTestCommand');
  }

  validate(context) {
    this.org = context.org;
    const options = context.flags;

    if (options.codecoverage && !options.resultformat) {
      return BBPromise.reject(almError('CoverageWithoutReporter'));
    }

    // Check of precompilewait is specified.
    if (options.precompilewait) {
      // if so validate it's a number
      if (!_.isNaN(_.toNumber(options.precompilewait))) {
        // normalize to milliseconds. Minutes is appropriate for the UI but millis is appropriate for the service.
        options.precompilewait = new Time(options.precompilewait).milliseconds;
      } else {
        return BBPromise.reject(
          almError(
            { keyName: 'invalidTimeout', bundle: 'apexPreCompileCommand' },
            // error message should specify minutes not millis.
            consts.DEFAULT_TIMEOUT.minutes
          )
        );
      }
    }

    // validate against the api service
    if (options.precompilewait && options.precompilewait < ApexCacheService.DEFAULT_TIMEOUT) {
      return BBPromise.reject(
        almError(
          { keyName: 'invalidTimeout', bundle: 'apexPreCompileCommand' },
          // error message should specify minutes not millis.
          consts.DEFAULT_TIMEOUT.minutes
        )
      );
    }

    // Display deprecation message when resultformat flag is used without a wait flag.
    if (options.resultformat && !options.wait) {
      logger.warnUser(context, messages().getMessage('apexTestCommandResultFormatDeprecation', [], 'apex'));
    }

    if (options.synchronous && !options.resultformat) {
      options.resultformat = 'human';
    }

    return BBPromise.resolve(options);
  }

  execute(context) {
    const testApi = new ApexTestApi(this.org);
    testApi.waitInMinutes = context.wait;
    testApi.socketTimeoutHandler = _socketTimeoutHandler;
    // context.precompilewait is converted to millis in validate.
    const precompileTimeout = context.precompilewait || ApexCacheService.DEFAULT_TIMEOUT;

    return testApi
      .initialize(context)
      .then(() =>
        new ApexCacheService(this.org, precompileTimeout).precompileSync().catch(err => {
          // Due to the limited states that are returned from the apex cache service. We will just let the apex
          // tests run if any error is returned from the service.
          this.logger.info('ApexCacheService reported an error. Continuing to run the tests.');
          this.logger.info(err.message);
          return null;
        })
      )
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

export = ApexTestCommand;

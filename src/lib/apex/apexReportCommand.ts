/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';
import * as BBPromise from 'bluebird';
import * as almError from '../core/almError';
import Messages = require('../messages');
const messages = Messages();
import { ApexTestApi } from './apexTestApi';

const _socketTimeoutHandler = function() {
  throw almError('genericTimeoutMessage', [], 'genericTimeoutWaitMessageAction');
};

class ApexReportCommand {
  // TODO: proper property typing
  [property: string]: any;

  reject(...args) {
    // @ts-ignore TODO: rewrite this without a compiler error
    const msg = messages.getMessage(...args);
    return BBPromise.reject(new Error(msg));
  }

  validate(context) {
    this.org = context.org;
    const testId = context.flags.testrunid;

    if (_.isNil(testId)) {
      return this.reject('apexReportCommandNoJobId');
    }

    // validate prefix of job id
    if (!/^707/.test(testId)) {
      return this.reject('apexReportCommandInvalidJobId', testId);
    }

    return BBPromise.resolve(context.flags);
  }

  /**
   * Retrieve test results.
   *
   * @param {object} context - Options object having following flags/inputs:
   *      - runTestId (array, required): Run test job id.
   *      - testArtifactDir (string):          file and path to log output
   *      - codeCoverage (boolean):      true to retrieve code coverage results
   */
  execute(context) {
    const testApi = new ApexTestApi(this.org);
    testApi.waitInMinutes = context.wait;
    testApi.socketTimeoutHandler = _socketTimeoutHandler;

    return (
      testApi
        .initialize(context)
        .bind(testApi)
        // First check to see if it is a valid job or the job is Completed
        .then(testApi.jobCheck)
        .then(job => {
          const promise = BBPromise.resolve();
          promise.then(() => testApi.reporter.emit('start', job.Id));
          return promise.then(() => job);
        })
        .then(job => {
          if (testApi.isJobFinished(job.Status)) {
            testApi.finished = true;
            // If we want to check the progress of the tests as
            // they are running, we can move this check outside of
            // this conditional.
            return testApi.checkProgress();
          } else {
            testApi.socketTimeoutHandler = _socketTimeoutHandler;
            const waitTillConnected = testApi.waitForResult();
            const waitTillDone = testApi.finish;
            // After waiting for the results via streaming, check the job again
            // to make sure it didn't complete in the time it took us to connect

            return waitTillConnected
              .then(() => testApi.jobCheck())
              .then(job2 => {
                if (testApi.isJobFinished(job2.Status)) {
                  testApi.finished = true;
                  testApi.stream.disconnect();
                  return testApi.checkProgress();
                } else {
                  return waitTillDone;
                }
              });
          }
        })
        .then(res => {
          // If any tests failed, change the exit code to 100
          if (_.get(res, 'summary.failing')) {
            process.exitCode = 100;
          }
          return res;
        })
    );
  }
}

export = ApexReportCommand;

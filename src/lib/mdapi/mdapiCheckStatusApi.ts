/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';

class CheckStatus {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  /*
        waitTime: wait time in minutes
        pollIntervalMs: interval in milliseconds to poll the server until the wait time is reached
        reporter: will be called with the results of the status request. Bind any additional arguments.
        boundCheckMethod: this is the force api call bound with any necessary arguments.
            - e.g org.force.mdapiCheckDeployStatus.bind(org.force, org, jobid);
    */
  constructor(waitTime, pollIntervalMs, reporter, boundCheckMethod, pollIntervalStrategy?) {
    this._checkStatus = boundCheckMethod;
    this._reporter = reporter;
    if (!reporter) {
      this._reporter = (status) => status;
    }

    this._wait = +waitTime;

    this._pollIntervalMs = pollIntervalMs;
    this._pollLocationMs = 0;
    this._pollTimeoutMs = this._minToMs(this._wait);
    this.pollIterations = 0;
    this.pollIntervalStrategy = pollIntervalStrategy;
  }

  handleStatus() {
    // Check deploy status
    return this._getStatus()
      .then((status) => this._reporter(status))
      .then(
        (status) =>
          new Promise((resolve, reject) => {
            if (status.done) {
              resolve(status);
            } else if (this._wait === 0) {
              resolve(status);
            } else {
              // eslint-disable-next-line @typescript-eslint/no-implied-eval
              setTimeout(this._pollForStatus.bind(this, resolve, reject), this._getCorrectInterval());
            }
          })
      )
      .then((status) => {
        this._pollLocationMs = 0;
        return status;
      });
  }

  _pollForStatus(resolve, reject) {
    let finishedPolling = false;
    if (this._wait > -1) {
      this._pollLocationMs += this._getCorrectInterval();
      finishedPolling = this._pollLocationMs >= this._pollTimeoutMs;
    }

    this._getStatus().then((status) => {
      if (finishedPolling) {
        if (!status.done) {
          status.timedOut = true;
        }
        resolve(status);
      } else if (status.done) {
        resolve(status);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        setTimeout(this._pollForStatus.bind(this, resolve, reject), this._getCorrectInterval());
      }
      this._reporter(status);
    });
  }

  _getCorrectInterval() {
    let correctInterval;

    if (!util.isNullOrUndefined(this.pollIntervalStrategy)) {
      correctInterval = this.pollIntervalStrategy.getInterval(this.pollIterations);
    } else {
      correctInterval = this._pollIntervalMs;
    }

    if (this._wait === -1) {
      return correctInterval;
    }

    if (this._pollTimeoutMs - (this._pollLocationMs + correctInterval) < 0) {
      correctInterval = this._pollTimeoutMs - this._pollLocationMs;
    }
    return correctInterval;
  }

  _getStatus() {
    return this._checkStatus().then((status) => {
      // If we're not waiting and the status is not done, the request will timeout.
      if (this._wait === 0 && !status.done) {
        status.timedOut = true;
      }
      this.pollIterations++;
      return status;
    });
  }

  _minToMs(min) {
    return min * 60000;
  }
}

export = CheckStatus;

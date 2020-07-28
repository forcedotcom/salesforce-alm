/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// 3pp
import * as BBPromise from 'bluebird';
import * as _ from 'lodash';
import * as util from 'util';
import cli from 'cli-ux';

// Local
import logger = require('../core/logApi');
import * as almError from '../core/almError';
import Messages = require('../messages');
const messages = Messages();
import CheckStatus = require('./mdapiCheckStatusApi');
import consts = require('../core/constants');
import Stash = require('../core/stash');
import { env, set } from '@salesforce/kit';
// for messages in FCT/messages/
import { Messages as MessagesCore } from '@salesforce/core';

MessagesCore.importMessagesDirectory(__dirname);

const DEPLOY_ERROR_EXIT_CODE = 1;

/**
 * API that wraps Metadata API to deploy source - directory or zip - to given org.
 *
 * @param force
 * @constructor
 */
class MdDeployReportApi {
  private scratchOrg;
  private logger;
  private pollIntervalStrategy;
  private loggingEnabled;
  private progressBar;
  private useProgressBar: boolean;

  constructor(org, pollIntervalStrategy?, private stashkey: string = Stash.Commands.MDAPI_DEPLOY) {
    this.scratchOrg = org;
    this.logger = logger.child('md-deploy-report');
    this._print = this._print.bind(this);
    this.pollIntervalStrategy = pollIntervalStrategy;
    this.progressBar = cli.progress({
      format: `${stashkey.split('_')[0]} PROGRESS | {bar} | {value}/{total} Components`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      linewrap: true
    });
  }

  _log(message: string): void {
    if (this.loggingEnabled) {
      this.logger.log(message);
    }
  }

  _logError(message: string): void {
    if (this.loggingEnabled) {
      this.logger.error(message);
    }
  }

  _printComponentFailures(result) {
    if (result.details && result.details.componentFailures) {
      if (!util.isArray(result.details.componentFailures)) {
        result.details.componentFailures = [result.details.componentFailures];
      }
      this.useProgressBar ? this.progressBar.stop() : this._printOldOutput(result);
      // sort by filename then fullname
      const failures: Array<string> = _.chain(result.details.componentFailures)
        .sortBy([
          function(o) {
            return o.fileName ? o.fileName.toUpperCase() : o.fileName;
          }
        ])
        .sortBy([
          function(o) {
            return o.fullName ? o.fullName.toUpperCase() : o.fullName;
          }
        ])
        .value();

      this.logger.log('');
      this.logger.styledHeader(this.logger.color.red(`Component Failures [${failures.length}]`));
      this.logger.table(failures, {
        columns: [
          { key: 'problemType', label: 'Type' },
          { key: 'fileName', label: 'File' },
          { key: 'fullName', label: 'Name' },
          { key: 'problem', label: 'Problem' }
        ]
      });
      this.logger.log('');
    }
  }

  _printTests(result) {
    if (result.details && result.details.runTestResult) {
      if (result.details.runTestResult.failures) {
        if (!util.isArray(result.details.runTestResult.failures)) {
          result.details.runTestResult.failures = [result.details.runTestResult.failures];
        }

        const tests: Array<string> = _.chain(result.details.runTestResult.failures)
          .sortBy([
            function(o) {
              return o.methodName.toUpperCase();
            }
          ])
          .sortBy([
            function(o) {
              return o.name.toUpperCase();
            }
          ])
          .value();
        this.progressBar.update(result.numberComponentsDeployed + result.numberTestsCompleted);
        this._log('');
        this.logger.styledHeader(this.logger.color.red(`Test Failures [${result.details.runTestResult.numFailures}]`));
        this.logger.table(tests, {
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'methodName', label: 'Method' },
            { key: 'message', label: 'Message' },
            { key: 'stackTrace', label: 'Stacktrace' }
          ]
        });
      }

      if (result.details && result.details.runTestResult.successes) {
        if (!util.isArray(result.details.runTestResult.successes)) {
          result.details.runTestResult.successes = [result.details.runTestResult.successes];
        }

        const tests: Array<String> = _.chain(result.details.runTestResult.successes)
          .sortBy([
            function(o) {
              return o.methodName.toUpperCase();
            }
          ])
          .sortBy([
            function(o) {
              return o.name.toUpperCase();
            }
          ])
          .value();
        this.progressBar.update(result.numberComponentsDeployed + result.numberTestsCompleted);

        this._log('');
        this.logger.styledHeader(
          this.logger.color.green(`Test Success [${result.details.runTestResult.successes.length}]`)
        );
        this.logger.table(tests, {
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'methodName', label: 'Method' }
          ]
        });
      }

      if (result.details && result.details.runTestResult.codeCoverage) {
        if (!util.isArray(result.details.runTestResult.codeCoverage)) {
          result.details.runTestResult.codeCoverage = [result.details.runTestResult.codeCoverage];
        }

        const coverage: Array<string> = _.chain(result.details.runTestResult.codeCoverage)
          .sortBy([
            function(o) {
              return o.name.toUpperCase();
            }
          ])
          .value();

        this._log('');
        this.logger.styledHeader(this.logger.color.blue('Apex Code Coverage'));
        this.logger.table(coverage, {
          columns: [
            { key: 'name', label: 'Name' },
            {
              key: 'numLocations',
              label: '% Covered',
              format: (numLocations, row) => {
                numLocations = parseInt(numLocations);
                const numLocationsNotCovered: number = parseInt(row.numLocationsNotCovered);
                let color = this.logger.color.green;

                // Is 100% too high of a bar?
                if (numLocationsNotCovered > 0) {
                  color = this.logger.color.red;
                }

                let pctCovered = 100;
                let coverageDecimal: number = parseFloat(
                  ((numLocations - numLocationsNotCovered) / numLocations).toFixed(2)
                );
                if (numLocations > 0) {
                  pctCovered = coverageDecimal * 100;
                }

                return color(`${pctCovered}%`);
              }
            },
            {
              key: 'locationsNotCovered',
              label: 'Uncovered Lines',
              format: locationsNotCovered => {
                if (!locationsNotCovered) {
                  return '';
                }

                if (!util.isArray(locationsNotCovered)) {
                  locationsNotCovered = [locationsNotCovered];
                }

                const uncoveredLines = [];
                locationsNotCovered.forEach(uncoveredLine => {
                  uncoveredLines.push(uncoveredLine.line);
                });

                return uncoveredLines.join(',');
              }
            }
          ]
        });
      }

      if (result.details.runTestResult.successes || result.details.runTestResult.failures) {
        this._log('');
        this._log(`Total Test Time:  ${result.details.runTestResult.totalTime}`);
      }
    }
  }

  _printComponentSuccess(result, options) {
    if (options.verbose && result.details && result.details.componentSuccesses) {
      if (!util.isArray(result.details.componentSuccesses)) {
        result.details.componentSuccesses = [result.details.componentSuccesses];
      }

      if (result.details.componentSuccesses.length > 0) {
        // sort by type then filename then fullname
        const files: Array<string> =
          result.details.componentSuccesses.length > 0
            ? _.chain(result.details.componentSuccesses)
                .sortBy([
                  function(o) {
                    return o.fullName ? o.fullName.toUpperCase() : o.fullName;
                  }
                ])
                .sortBy([
                  function(o) {
                    return o.fileName ? o.fileName.toUpperCase() : o.fileName;
                  }
                ])
                .sortBy([
                  function(o) {
                    return o.componentType ? o.componentType.toUpperCase() : o.componentType;
                  }
                ])
                .value()
            : [];

        this._log('');
        this.logger.styledHeader(this.logger.color.blue(`Components Deployed [${result.numberComponentsDeployed}]`));
        this.logger.table(files, {
          columns: [
            { key: 'componentType', label: 'Type' },
            { key: 'fileName', label: 'File' },
            { key: 'fullName', label: 'Name' },
            { key: 'id', label: 'Id' }
          ]
        });
      }
    }
  }

  _print(options, result) {
    if ((this.loggingEnabled || options.source) && !options.json) {
      if (this.useProgressBar) {
        const total = result.numberComponentsTotal + result.numberTestsTotal;
        const actionsDone = result.numberComponentsDeployed + result.numberTestsCompleted;
        // If the metadata deploy isn't picked up yet, there will be no total of components or tests yet so we
        // need to start the progressBar again. We shouldn't do it every time because it resets the time on the
        // progressBar. Also, the total can change when a deploy ha succeeded... for whatever reason.
        if (this.progressBar.isActive && total === this.progressBar.total) {
          // Don't update the progress bar if nothing has changed. Removes unnecessary noise in non-tty environments
          if (actionsDone !== this.progressBar.value) {
            this.progressBar.update(actionsDone);
          }
        } else {
          this.progressBar.start(total, actionsDone);
        }
      } else {
        this._printOldOutput(result);
      }

      if (result.timedOut) {
        this.useProgressBar ? this.progressBar.stop() : this._printOldOutput(result);
        this._log(messages.getMessage('mdDeployCommandCliWaitTimeExceededError', [options.wait]));
        return result;
      }
    }

    if (result.completedDate) {
      /** This should be called only for mdapi:deploy. The result of source:deploy is handled differently*/
      if (this.stashkey === 'MDAPI_DEPLOY') {
        this._printComponentSuccess(result, options);
        this._printComponentFailures(result);
      }
      // source:deploy handles success and errors separately, it doesn't handle test output
      this._printTests(result);

      if (options.checkonly) {
        this._printComponentFailures(result);
        if (!result.numberComponentErrors) {
          const coreMessages = MessagesCore.loadMessages('salesforce-alm', 'source_deploy');
          this._log(coreMessages.getMessage('sourceDeployCheckOnlySuccess'));
        }
      }

      this.useProgressBar ? this.progressBar.stop() : this._printOldOutput(result);
    }

    return result;
  }

  report(options): BBPromise {
    // Logging is enabled if the output is not json and logging is not disabled
    this.loggingEnabled = options.source || options.verbose || (!options.json && !options.disableLogging);
    options.wait = +(options.wait || consts.DEFAULT_MDAPI_WAIT_MINUTES);
    this._log(`Job ID | ${options.jobid}`);

    // if SFDX_USE_PROGRESS_BAR is true use progress bar, if not use old output
    this.useProgressBar = env.getBoolean('SFDX_USE_PROGRESS_BAR', true);

    return BBPromise.resolve()
      .then(() => this._doDeployStatus(options))
      .then(result => this._throwErrorIfDeployFailed(result))
      .catch(err => {
        if (err.name === 'sf:MALFORMED_ID') {
          throw almError('mdDeployCommandCliInvalidJobIdError', options.jobid);
        } else {
          throw err;
        }
      });
  }

  async validate(context): BBPromise {
    const options = context.flags;

    let stashedValues = await Stash.list(this.stashkey);

    if (!options.jobid) {
      options.jobid = options.jobid || stashedValues.jobid;
    }

    if (!options.jobid) {
      return BBPromise.reject(almError('MissingRequiredParameter', 'jobid'));
    }

    // Wait must be a number that is greater than zero or equal to -1.
    const validWaitValue = !isNaN(+options.wait) && (+options.wait === -1 || +options.wait >= 0);
    if (options.wait && !validWaitValue) {
      return BBPromise.reject(almError('mdapiCliInvalidWaitError'));
    }

    return BBPromise.resolve(options);
  }

  _doDeployStatus(options): BBPromise {
    const jobid: string = options.jobid;
    const org = this.scratchOrg;

    if (options.result && options.wait == 0 && !options.deprecatedStatusRequest) {
      // this will always be a timeout condition since we never call CheckStatus.handleStatus()
      options.result.timedOut = true;
      this._print(options, options.result);
      return options.result;
    }

    return new CheckStatus(
      options.wait,
      consts.DEFAULT_MDAPI_POLL_INTERVAL_MILLISECONDS,
      this._print.bind(this, options),
      org.force.mdapiCheckDeployStatus.bind(org.force, org, jobid),
      this.pollIntervalStrategy
    )
      .handleStatus()
      .then(res => {
        this.useProgressBar ? this.progressBar.stop() : this._printOldOutput(res);
        return res;
      });
  }

  _throwErrorIfDeployFailed(result): BBPromise {
    if (result.status === 'Failed') {
      const err = almError('mdapiDeployFailed');
      this._setExitCode(DEPLOY_ERROR_EXIT_CODE);
      set(err, 'result', result);
      return BBPromise.reject(err);
    }

    return BBPromise.resolve(result);
  }

  _setExitCode(code): void {
    process.exitCode = code;
  }

  _printOldOutput(result: any) {
    this._log('');
    this._log(`Status:  ${result.status}`);
    this._log(`jobid:  ${result.id}`);
    if (result.status !== 'Queued') {
      const successfulComponentsMessage: string = result.checkOnly
        ? `Components checked:  ${result.numberComponentsDeployed}`
        : `Components deployed:  ${result.numberComponentsDeployed}`;
      if (result.completedDate) {
        this._log(`Completed:  ${result.completedDate}`);
      }
      this._log(`Component errors:  ${result.numberComponentErrors}`);
      this._log(successfulComponentsMessage);
      this._log(`Components total:  ${result.numberComponentsTotal}`);
      this._log(`Tests errors:  ${result.numberTestErrors}`);
      this._log(`Tests completed:  ${result.numberTestsCompleted}`);
      this._log(`Tests total:  ${result.numberTestsTotal}`);
      this._log(`Check only: ${result.checkOnly}`);
    }
  }
}

export = MdDeployReportApi;

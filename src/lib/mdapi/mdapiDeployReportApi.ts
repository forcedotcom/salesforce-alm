/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// 3pp
import * as BBPromise from 'bluebird';
import * as _ from 'lodash';
import * as util from 'util';

// Local
import logger = require('../core/logApi');
import * as almError from '../core/almError';
import Messages = require('../messages');
const messages = Messages();
import CheckStatus = require('./mdapiCheckStatusApi');
import consts = require('../core/constants');
import Stash = require('../core/stash');
import { set } from '@salesforce/kit';

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

  constructor(org, pollIntervalStrategy?, private stashkey: string = Stash.Commands.MDAPI_DEPLOY) {
    this.scratchOrg = org;
    this.logger = logger.child('md-deploy-report');
    this._print = this._print.bind(this);
    this.pollIntervalStrategy = pollIntervalStrategy;
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

  _print(options, result) {
    if (this.loggingEnabled) {
      const deployStart: number = new Date(result.createdDate).getTime();
      const deployEnd: number = new Date(result.completedDate).getTime();
      const totalDeployTime: number = deployEnd - deployStart;
      const processingHeader: string = this.logger.color.yellow('Status');
      const successHeader: string = this.logger.color.green('Result');
      const failureHeader: string = this.logger.color.red('Result');
      this._log('');
      if (!result.done) {
        this.logger.styledHeader(processingHeader);
      } else {
        if (result.completedDate) {
          this._log(`Deployment finished in ${totalDeployTime}ms`);
        }
        this._log('');
        const header: string = result.success ? successHeader : failureHeader;
        this.logger.styledHeader(header);
      }
      const successfulComponentsMessage: string = result.checkOnly
        ? `Components checked:  ${result.numberComponentsDeployed}`
        : `Components deployed:  ${result.numberComponentsDeployed}`;

      this._log(`Status:  ${result.status}`);
      this._log(`jobid:  ${result.id}`);

      if (result.status !== 'Queued') {
        if (result.completedDate) {
          this._log(`Completed:  ${result.completedDate}`);
        } // TODO: convert to locale
        this._log(`Component errors:  ${result.numberComponentErrors}`);
        this._log(successfulComponentsMessage);
        this._log(`Components total:  ${result.numberComponentsTotal}`);
        this._log(`Tests errors:  ${result.numberTestErrors}`);
        this._log(`Tests completed:  ${result.numberTestsCompleted}`);
        this._log(`Tests total:  ${result.numberTestsTotal}`);
        this._log(`Check only: ${result.checkOnly}`);

        this._printComponentFailures(result);

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

            this._log('');
            this.logger.styledHeader(
              this.logger.color.red(`Test Failures [${result.details.runTestResult.numFailures}]`)
            );
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

            this._log('');
            this.logger.styledHeader(
              this.logger.color.green(`Test Success [${result.details.runTestResult.successes.length}]`)
            );
            this.logger.table(tests, {
              columns: [{ key: 'name', label: 'Name' }, { key: 'methodName', label: 'Method' }]
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
            this.logger.styledHeader(
              this.logger.color.blue(`Components Deployed [${result.numberComponentsDeployed}]`)
            );
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

      this._log('');

      if (result.timedOut) {
        this._log(messages.getMessage('mdDeployCommandCliWaitTimeExceededError', [options.wait]));
      }
    }

    return result;
  }

  report(options): BBPromise {
    // Logging is enabled if the output is not json and logging is not disabled
    this.loggingEnabled = options.verbose || (!options.json && !options.disableLogging);
    options.wait = +(options.wait || consts.DEFAULT_MDAPI_WAIT_MINUTES);

    return BBPromise.resolve()
      .then(result => this._doDeployStatus(options))
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
      this._print.bind(this, options)(options.result);
      return options.result;
    }

    return new CheckStatus(
      options.wait,
      consts.DEFAULT_MDAPI_POLL_INTERVAL_MILLISECONDS,
      this._print.bind(this, options),
      org.force.mdapiCheckDeployStatus.bind(org.force, org, jobid),
      this.pollIntervalStrategy
    ).handleStatus();
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
}

export = MdDeployReportApi;

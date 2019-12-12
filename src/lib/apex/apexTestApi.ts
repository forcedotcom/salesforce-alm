/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Force.com Continuous Integration CLI Test APIs to invoke tests and retrieve test results.
 *
 * $ force:apex:test:run    - invokes tests of given Apex Class Ids or Apex Suite Ids.
 * $ force:apex:test:report  - gets test results for given testrunid
 *
 */

const TEST_RESULT_FILE_PREFIX = 'test-result';
const TEST_RUN_ID_FILE = 'test-run-id.txt';
const TOPIC = '/systemTopic/TestResult';

// ** external modules **
import * as path from 'path';
import * as fs from 'fs';
import * as BBPromise from 'bluebird';
import * as _ from 'lodash';
import * as moment from 'moment';

const mkdirp = BBPromise.promisify(require('mkdirp'));

const writeFile = BBPromise.promisify(fs.writeFile);

import logger = require('../core/logApi');
import StreamClient = require('../core/status');
import consts = require('../core/constants');
import messages = require('../messages');
import * as almError from '../core/almError';
import { HumanReporter, TapReporter, JUnitReporter, JsonReporter, NoOpReporter } from '../test/reporter';
import TestResults = require('../test/testResults');
import { Dictionary } from '@salesforce/ts-types';

const TEST_LEVELS = {
  all: 'RunAllTestsInOrg',
  local: 'RunLocalTests',
  specific: 'RunSpecifiedTests'
};

/**
 * Turn a value into a string. Right now, only handles string values, otherwise
 * it just returns the value.
 *
 * @param {any} val The value to turn into a string
 * @return {array} The array representation of the value
 */
function arrayify(value) {
  if (_.isString(value)) {
    return value.split(',');
  }
  return value;
}

/**
 * Output the test results in a human readable way
 */
class ApexHumanReporter extends HumanReporter {
  constructor(testApi) {
    super(testApi.logger, testApi.config);
  }

  static getDefaultCodeCoveragePercentage() {
    return 75;
  }

  onFinished(apexTestResults) {
    if (apexTestResults.coverage) {
      this.logTable('Apex Code Coverage', apexTestResults.coverage.coverage, [
        { key: 'id', label: 'Id' },
        { key: 'name', label: 'Name' },
        {
          key: 'coveredPercent',
          label: '% Covered',
          format: percent => {
            let color = this.logger.color.red;
            // Keep the color as the apex code requirement, or allow
            // for custom requirements.
            if (
              percent >=
              (process.env.SFDX_CODE_COVERAGE_REQUIREMENT || ApexHumanReporter.getDefaultCodeCoveragePercentage())
            ) {
              color = this.logger.color.green;
            }
            return color(`${percent}%`);
          }
        },
        {
          key: 'lines',
          label: 'Uncovered Lines',
          format: lines => {
            const uncoveredNumbers = Object.keys(_.pickBy(lines, line => !line)).join(',');
            if (uncoveredNumbers.length > 0) {
              return this.logger.color.red(uncoveredNumbers);
            }
            return '';
          }
        }
      ]);
    }
    return super.onFinished(apexTestResults);
  }
}

/**
 * Apex TAP reporter implementation.
 */
class ApexTapReporter extends TapReporter {
  constructor(testApi) {
    super(testApi.logger);
    this.api = testApi;
    this.results = {};
  }

  onStart(testrunid) {
    return this.api.force.getApexTestRunResult(this.api.org, testrunid).then(res => {
      if (_.get(res.records, 'length')) {
        this.logTapStart(res.records[0].MethodsEnqueued);
      }
    });
  }

  /**
   * Receive notifications on progress to output TAP lines as the tests finish.
   * NOTE: This will use more API calls since it will query the queue items every
   *  streaming event.
   */
  onProgress(queueItems) {
    const promise = this.api.force.getAsyncTestResults(this.api.org, queueItems).then(res => {
      res.records.forEach(testResult => {
        if (!this.results[testResult.Id]) {
          this.results[testResult.Id] = testResult;
          this.logTapResult(testResult);
        }
      });
    });
    this.operations.push(promise);
    return promise;
  }

  getFullTestName(testResult) {
    return `${testResult.ApexClass.Name}.${testResult.MethodName}`;
  }

  onFinished(apexTestResults) {
    if (this.api.synchronous && apexTestResults) {
      this.logTapStart(apexTestResults.total);
      apexTestResults.tests.forEach(testResult => {
        this.logTapResult(testResult);
      });
    } else {
      let reportArgs = `-i ${this.api.testrunid}`;
      if (this.api.username) {
        reportArgs += ` -u ${this.api.username}`;
      }
      this.log(this.api.messages.getMessage('apexTestApiReportForFormatHint', [reportArgs], 'apex'));
      return super.onFinished();
    }
  }
}

class ApexJUnitReporter extends JUnitReporter {
  constructor(testApi) {
    super(testApi.logger);
  }
}

class ApexJsonReporter extends JsonReporter {
  constructor(testApi) {
    super(testApi.logger);
  }
}

/**
 * A list of the accepted reporter types
 */
export const ReporterTypes = {
  human: ApexHumanReporter,
  tap: ApexTapReporter,
  json: ApexJsonReporter,
  junit: ApexJUnitReporter
};

/**
 *  A container for the apex test results that provides helpers around formating
 *  and logging test results.
 */
class ApexTestResults extends TestResults {
  constructor(testApi, tests, runResultSummaries, config) {
    super(testApi.testrunid, testApi.startTime, 'force.apex', tests, runResultSummaries, config);
  }

  getTestContainerName(test) {
    return test.ApexClass.Name;
  }

  getTestNamespace(test) {
    return test.ApexClass.NamespacePrefix;
  }

  getTestName(test) {
    return test.MethodName;
  }
}

export class ApexTestApi {
  static TEST_LEVELS = TEST_LEVELS;
  static ApexHumanReporter = ApexHumanReporter;

  // TODO: proper property typing
  [property: string]: any;

  /**
   * The API class that manages running of apex tests. By default it will run
   * all local namespaced tests unless initialized with other options.
   *
   * @param org {object} The org for running tests.
   */
  constructor(org) {
    this.org = org;
    this.force = org.force;
    this.config = org.config;

    this.messages = messages(this.force.config.getLocale());
    this.startTime = moment();
    this.logger = logger.child('apexTestApi', { username: org.getName() });

    // no-op report that will log; may be overriden by --resultformat
    this.reporter = new NoOpReporter(this.logger);
    this.waitForResults = false;

    // Apply defaults
    Object.assign(this, {
      suitenames: [],
      classnames: [],
      tests: [],
      suiteids: [],
      prefix: '',
      codecoverage: false,
      synchronous: false,
      testlevel: TEST_LEVELS.local
    });
  }

  /**
   * Sets the function to call once the StreamClient socket times out
   * @param callback {function} - the function to invoke;
   */
  set socketTimeoutHandler(callback) {
    if (!_.isNil(callback) && _.isFunction(callback)) {
      this._socketTimeoutHandler = callback;
    } else {
      throw almError({
        keyName: 'invalidValueForSocketTimeoutHandler',
        bundle: 'apex'
      });
    }
  }

  /**
   * Gets the socket timeout handler function.
   * @returns {function}
   */
  get socketTimeoutHandler() {
    return this._socketTimeoutHandler;
  }

  /**
   * Sets the wait timeout in minutes
   * @param value {number} - wait timeout in minutes
   */
  set waitInMinutes(value) {
    this._wait = StreamClient.validateWaitValue(value);
  }

  /**
   * Sets the get timeout in minutes
   * @returns {number}
   */
  get waitInMinutes() {
    return this._wait;
  }

  hasOutputDirectory() {
    return _.isString(this.outputdir) && !_.isEmpty(this.outputdir);
  }

  /**
   * Create the output directory the the test results will be stored if doesn't exist
   */
  setupOutputDirectory() {
    const outputdir = this.outputdir;
    if (this.hasOutputDirectory()) {
      this.files = [];
      return mkdirp(outputdir)
        .then(() => outputdir)
        .catch(error => {
          // It is ok if the directory already exist
          if (error.name !== 'EEXIST') {
            throw error;
          }
        });
    }
    return BBPromise.resolve();
  }

  /**
   * Initialize the apex test api to specify additional options and setup the
   * output directory if needed.
   *
   * @param {object} options The options used to run the tests. You can see a
   * list of valid options in the by looking at the defaults in the constructor.
   * @param {object} logger The logger object, which should typically be the
   * heroku cli.
   */
  initialize(options: Dictionary<any> = {}) {
    // Apply all the user defined setting (will override defaults)
    _.merge(this, options);

    // can only have classnames OR suitenames OR tests
    if ((options.classnames && (options.suitenames || options.tests)) || (options.suitenames && options.tests)) {
      return BBPromise.reject(almError('apexTestApiInvalidParams'));
    }

    if (this.resultformat || this.wait) {
      // Validate the reporter;  Default to human readable format.
      this.resultformat = this.resultformat || 'human';
      let reporter = ReporterTypes[this.resultformat];

      if (!reporter) {
        return BBPromise.reject(almError('apexTestApiInvalidReporter', Object.keys(ReporterTypes).join(',')));
      }

      // The --json flag overrides resultformat as mentioned in --help.
      // Don't do this above, as we still validate the reporter
      if (this.json) {
        this.resultformat = 'json';
        // Reset the reporter with new result format
        reporter = ReporterTypes[this.resultformat];
      }

      if (this.resultformat === 'json') {
        // If the reporter is json, make sure the json flag is also set
        this.json = true;
        options.json = true;
      }

      this.reporter = new reporter(this);
      this.waitForResults = true;
    }

    // Validate the testLevel if user provided
    if (options.testlevel) {
      const allLevels = _.values(TEST_LEVELS);
      if (!_.includes(allLevels, options.testlevel)) {
        return BBPromise.reject(almError('apexTestApiInvalidTestLevel', [options.testlevel, _.join(allLevels)]));
      }
    }

    this.suitenames = arrayify(this.suitenames);
    this.classnames = arrayify(this.classnames);
    this.tests = arrayify(this.tests);

    // Run specified tests if the user specified tests
    if (this.suitenames.length || this.classnames.length || this.tests.length) {
      // When specifying suites or classes and a testlevel, the testlevel must be "RunSpecifiedTests"
      if (options.testlevel && options.testlevel !== TEST_LEVELS.specific) {
        return BBPromise.reject(almError('apexTestApiIncorrectTestLevel'));
      }
      this.testlevel = TEST_LEVELS.specific;
    }

    this.completed = {};

    this.synchronous = options.synchronous;

    return this.setupOutputDirectory().then(() => {
      if (
        this.hasOutputDirectory() &&
        !this.reporter.isType(NoOpReporter) &&
        // json results written in logTestArtifacts
        !this.reporter.isType(JsonReporter)
      ) {
        const writeStream = fs.createWriteStream(this.getResultFilePath());
        this.files.push({
          format: this.reporter.getFormat(),
          file: this.getResultFilePath()
        });
        this.reporter.addStream(writeStream);
        return new BBPromise((res, rej) => {
          writeStream.on('open', res);
          writeStream.on('error', rej);
        });
      }
      return BBPromise.resolve();
    });
  }

  getResultFilePath() {
    return path.join(this.outputdir, `${TEST_RESULT_FILE_PREFIX}.${this.reporter.getFormat()}`);
  }

  isRunAllTest() {
    return _.includes([TEST_LEVELS.local, TEST_LEVELS.all], this.testlevel);
  }

  /**
   * Map the results to an array of ids.
   * TODO this should be removed when we can pass names to the server.
   */
  resultToIds(nameField, result, original) {
    if (!_.isObjectLike(result) || !_.isArray(result.records)) {
      throw almError('apexReportCommandInvalidResponse', original);
    }

    if (result.records.length <= 0) {
      throw almError('apexReportCommandNoTestFound', _.isArray(original) ? original.join(',') : original);
    }

    const ids = [];
    const registry = {};

    // Name to Test mapping
    result.records.forEach(record => {
      registry[record[nameField]] = record;
    });
    original.forEach(name => ids.push(registry[name].Id));

    return ids;
  }

  /**
   * Assemble tests config as array of classnames only.
   *
   * https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources.htm
   */
  assembleClassnameConfig() {
    const classNames = this.classnames.join(',');
    const skipCodeCoverage = !this.codecoverage;
    return BBPromise.resolve({ classNames, skipCodeCoverage });
  }

  // TODO remove when we can specify names to the API
  /**
   * Assemble tests config as array of classnames only.
   *
   * https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources.htm
   */
  querySuiteIds() {
    let query = 'SELECT Id, TestSuiteName FROM ApexTestSuite';
    query += ` WHERE TestSuiteName IN ('${this.suitenames.join("','")}')`;

    return this.force.toolingQuery(this.org, query).then(results => ({
      suiteids: this.resultToIds('TestSuiteName', results, this.suitenames).join(','),
      skipCodeCoverage: !this.codecoverage
    }));
  }

  /**
   * Assemble tests config as array of classnames or classids and testMethods to run, if applicable.
   *
   * https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_rest_resources.htm
   *
   * @param testsToRun - comma-delimited list
   */
  assembleTestsConfig(testsToRun = []) {
    return this.queryNamespaces().then(namespaces => {
      const testsConfig = new Map();

      // loop thru each given class to construct tests array
      testsToRun.forEach(item => {
        if (_.isEmpty(item)) {
          return;
        }

        const itemParts = item.split('.');

        // break-up classname string into parts for evaluation:
        // ns (if applicable), classname, test method ns (if applicable)
        let classNameOrId;
        let testMethod;
        if (itemParts.length === 3) {
          classNameOrId = `${itemParts[0]}.${itemParts[1]}`;
          testMethod = itemParts[2];
        } else if (itemParts.length === 2) {
          // handle if class is fully qualified (all test in class
          // will be invoked) or if we have classname.testmethod
          const nsOrClassnameOrClassid = itemParts[0];
          if (namespaces.has(nsOrClassnameOrClassid.toLowerCase())) {
            classNameOrId = `${itemParts[0]}.${itemParts[1]}`;
          } else {
            classNameOrId = itemParts[0];
            testMethod = itemParts[1];
          }
        } else {
          classNameOrId = itemParts[0];
        }

        // assemble className test config
        // see if there's an existing config for class
        const classNameOrIdLower = classNameOrId.toLowerCase();
        let newOrExistingClassConfig = testsConfig.get(classNameOrIdLower);
        if (!newOrExistingClassConfig) {
          const prop = classNameOrIdLower.startsWith('01p') ? 'classId' : 'className';
          newOrExistingClassConfig = {};
          newOrExistingClassConfig[prop] = classNameOrId;
          testsConfig.set(classNameOrIdLower, newOrExistingClassConfig);
        }

        // assemble testMethod test config
        if (testMethod) {
          if (!newOrExistingClassConfig.testMethods) {
            newOrExistingClassConfig.testMethods = [];
          }
          newOrExistingClassConfig.testMethods.push(testMethod);
        }
      });

      // convert map iterator to test config array
      const tests = [...testsConfig.values()];
      return { tests };
    });
  }

  queryNamespaces() {
    if (!this.namespaces) {
      // initialize and load namespaces - org namespace and all installed
      this.namespaces = new Set();

      const getNamespace = () => {
        const query = 'SELECT NamespacePrefix FROM Organization';
        return this.force.query(this.org, query).then(results => {
          if (results && results.records && results.records[0] && !_.isEmpty(results.records[0].NamespacePrefix)) {
            this.namespaces.add(results.records[0].NamespacePrefix.toLowerCase());
          }

          return BBPromise.resolve(null);
        });
      };

      const getInstalledNamespaces = () => {
        const query = 'SELECT NamespacePrefix FROM PackageLicense';
        return this.force.query(this.org, query).then(results => {
          if (results && results.records) {
            results.records.forEach(packageLicense => {
              if (!_.isEmpty(packageLicense.NamespacePrefix)) {
                this.namespaces.add(packageLicense.NamespacePrefix.toLowerCase());
              }
            });
          }

          return BBPromise.resolve(null);
        });
      };

      return BBPromise.all([getNamespace(), getInstalledNamespaces()]).then(() => this.namespaces);
    }

    return BBPromise.resolve(this.namespaces);
  }

  /**
   * Run the tests specified on this apexTestApi object by creating an apex
   * test run job. Depending on the options specified in this apexTestApi,
   * it will also wait for those results via the streaming API which will
   * also log and store those results.
   */
  runTests() {
    const runAsync = data => {
      let waitTillConnected = BBPromise.resolve();
      let waitTillDone = BBPromise.resolve();
      // Start to listen to results before we kick off the test,
      // so we don't miss any of the action.
      if (this.waitForResults) {
        waitTillConnected = this.waitForResult();
        waitTillDone = this.finish;
      }
      return waitTillConnected
        .then(() => {
          if (this.verbose) {
            this.reporter.log(
              this.targetusername ? `Invoking Apex tests using ${this.targetusername}...` : 'Invoking Apex tests...'
            );
          }
        })
        .then(() => this.force.runTestsAsynchronous(this.org, data))
        .then(res => {
          const promise = BBPromise.resolve();
          if (this.waitForResults) {
            promise.then(() => this.reporter.emit('start', res));
          }
          return promise.then(() => res);
        })
        .then(res => this.processResultId(res))
        .then(res => {
          if (!this.waitForResults) {
            return res;
          } else {
            return waitTillDone;
          }
        })
        .catch(err => {
          let error = almError('InvalidAsyncTestJob', err.message);
          if (err.errorCode && err.errorCode === 'UNKNOWN_EXCEPTION') {
            // I've ran into cases where the returned error only has this message: 'Unable to invoke async test job: An unknown exception occurred.'
            // Not very helpful. After some investigation it turns out to be org limits. 'AsyncApexTests - Limit Exceeded'
            error = almError({ keyName: 'InvalidAsyncTestJob', bundle: 'default' }, [err.message], {
              keyName: 'InvalidAsyncTestJobUnknownAction',
              bundle: 'default'
            });
          }

          if (err.name === 'INVALID_INPUT') {
            error = almError('InvalidAsyncTestJobNoneFound', err.message);
          }

          if (this.stream) {
            this.stream.disconnect();
            this.finishReject(error);
            return waitTillDone;
          }

          throw error;
        });
    };

    const runSync = data => {
      if (this.verbose) {
        this.reporter.log(
          this.targetusername ? `Invoking Apex tests using ${this.targetusername}...` : 'Invoking Apex tests...'
        );
      }
      let config;
      return this.org
        .getConfig()
        .then(c => {
          config = c;
        })
        .then(() => this.force.runTestsSynchronous(this.org, data))
        .then(res => {
          const tests = this.convertSynchronousResultsToApexTestResult(res.successes, res.failures);
          const runResultSummary = [this.convertSynchronousResultsToRunSummary(res)];
          this.testResults = new ApexTestResults(this, tests, runResultSummary, config);
        })
        .then(() => {
          if (this.codecoverage) {
            return this.retrieveApexCodeCoverage();
          }
          return undefined;
        })
        .then(coverage => {
          this.testResults.coverage = coverage;
        })
        .then(() => this.logTestArtifacts())
        .then(() => {
          this.reporter.emit('finished', this.testResults);
        })
        .then(() => this.testResults.toJson())
        .catch(err => {
          const error = almError({ keyName: 'apexTestSynchronousRunFailed', bundle: 'apex' }, [err.message]);
          throw error;
        });
    };

    if (this.synchronous && (this.suitenames.length > 0 || this.classnames.length > 1)) {
      // async api only supports running tests in same class, ie must use async when
      // running tests across multiple classes/suites; check for --tests perform post config assembly
      return BBPromise.reject(
        almError({
          keyName: 'apexTestCommandInvalidSynchronousParams',
          bundle: 'apex'
        })
      );
    } else if (this.synchronous && this.classnames.length === 1) {
      // runTestsSynchronous takes { tests: []} body
      return this.assembleTestsConfig(this.classnames).then(runSync);
    } else if (this.isRunAllTest()) {
      return runAsync({
        testLevel: this.testlevel,
        skipCodeCoverage: !this.codecoverage
      });
    } else if (this.tests.length > 0) {
      return this.assembleTestsConfig(this.tests).then(testConfig => {
        const runTestsAPI = this.synchronous ? runSync : runAsync;
        if (this.synchronous && testConfig.tests.length > 1) {
          // async api only supports running tests in same class, ie must use sync when
          // running tests across multiple classes/suites
          return BBPromise.reject(
            almError({
              keyName: 'apexTestCommandInvalidSynchronousParams',
              bundle: 'apex'
            })
          );
        } else {
          testConfig.skipCodeCoverage = !this.codecoverage;
        }

        return runTestsAPI(testConfig);
      });
    } else if (this.classnames.length > 0) {
      return this.assembleClassnameConfig().then(runAsync);
    } else if (this.suitenames.length > 0) {
      return this.querySuiteIds().then(runAsync);
    } else {
      return BBPromise.reject(almError(this.messages.getMessage('apexTestCommandInvalidTestlevel', [], 'apex')));
    }
  }

  processResultId(results) {
    this.testrunid = results;
    if (this.verbose) {
      this.reporter.log(`Started async test run job: ${this.testrunid}`);
    }

    const logHelp = () => {
      // Tell the user how to get the results
      if (!this.waitForResults) {
        let reportArgs = `-i ${this.testrunid}`;
        if (this.targetusername) {
          reportArgs += ` -u ${this.targetusername}`;
        }
        this.logger.log(this.messages.getMessage('apexTestApiReportHint', [reportArgs], 'apex'));
        return {
          testRunId: this.testrunid
        };
      }
      return {};
    };

    // write testrunid to file
    if (this.hasOutputDirectory()) {
      const file = path.join(this.outputdir, TEST_RUN_ID_FILE);
      this.files.push({ format: 'txt', file });
      return writeFile(file, this.testrunid).then(() => {
        if (this.verbose) {
          this.reporter.log(`Test run id written to ${file}`);
        }
        return logHelp();
      });
    } else {
      return BBPromise.resolve(logHelp());
    }
  }

  checkProgress() {
    return this.force.getAsyncTestStatus(this.org, this.testrunid).then(statuses => {
      let allCompleted = true;

      statuses.records.forEach(status => {
        if (!this.completed[status.Id]) {
          if (status.Status === 'Completed' || status.Status === 'Failed') {
            this.completed[status.Id] = status;
          } else {
            allCompleted = false;
          }
        }
      });

      let progress = BBPromise.resolve();

      if (this.waitForResults && this.reporter.progressRequired) {
        progress = progress.then(() => this.reporter.emit('progress', statuses.records.map(rec => rec.Id)));
      }

      // If this is called each time we get a stream, the overall test run
      // may not be finished, so check before processing results.
      if (allCompleted && this.finished) {
        progress = progress.then(() => this.retrieveAndStoreTestResults(Object.keys(this.completed)));
      }
      return progress;
    });
  }
  retrieveJobStatus() {
    return this.force.retrieve(this.org, 'AsyncApexJob', this.testrunid);
  }
  handleTimeout(message) {
    if (_.isFunction(this.socketTimeoutHandler)) {
      try {
        this.socketTimeoutHandler(message, this);
      } catch (err) {
        this.finishReject(err);
      }
    }
    return this.finish;
  }
  handleMessage(message) {
    if (!_.isNil(message.errorName) && message.errorName === consts.LISTENER_ABORTED_ERROR_NAME) {
      // Check job status just in case we missed the streaming event.
      return this.retrieveJobStatus()
        .then(job => {
          if (this.isJobFinished(job.Status)) {
            this.finished = true;
            return this.checkProgress();
          }
          return this.handleTimeout(message);
        })
        .catch(this.handleTimeout.bind(this, message));
    }

    const jobId = message.sobject.Id;

    if (this.verbose) {
      this.reporter.log(`Processing event for job ${jobId}`);
    }
    if (jobId.match(`^${this.testrunid}`)) {
      return this.retrieveJobStatus()
        .then(job => {
          if (this.isJobFinished(job.Status)) {
            this.finished = true;
            this.stream.disconnect();
            return this.checkProgress();
          }

          // If the reporter wants progress updates, checkProgress every time,
          // otherwise don't waste the resources
          if (this.waitForResults && this.reporter.progressRequired) {
            return this.checkProgress();
          }
          return BBPromise.resolve();
        })
        .catch(err => {
          this.finishReject();
          throw err;
        });
    }
    return BBPromise.resolve();
  }

  waitForResult() {
    if (this.verbose) {
      this.reporter.log('Listening for results');
    }
    this.stream = new StreamClient(this.org);
    this.stream.waitInMinutes = this.waitInMinutes;

    // Set up a finish handler that can be resolve when streaming finishes,
    // or right when the run is completed
    this.finish = new BBPromise((resolve, reject) => {
      this.finishResolve = resolve;
      this.finishReject = reject;
    });

    return this.stream.subscribe(TOPIC, this.handleMessage.bind(this), true);
  }

  isJobFinished(status) {
    // From https://developer.salesforce.com/docs/atlas.en-us.210.0.api.meta/api/sforce_api_objects_asyncapexjob.htm
    return ['Completed', 'Aborted', 'Failed'].indexOf(status) >= 0;
  }

  // check for valid job
  jobCheck() {
    return this.force.getAsyncJob(this.org, this.testrunid).then(resp => {
      if (!resp || !resp.records || resp.records.length === 0) {
        return BBPromise.reject(almError('apexTestApiInvalidTestRunId', this.testrunid));
      } else {
        return resp.records[0];
      }
    });
  }

  /**
   * Retrieve the test results and code coverage for the completed queued items,
   * then store them by logging the test results to the client and filesystem.
   *
   * @param {array} apexTestQueueItemIds An array of *completed* apex queue record Ids.
   */
  retrieveAndStoreTestResults(apexTestQueueItemIds) {
    if (this.verbose) {
      this.reporter.log(`Retrieving test results for job ${this.testrunid}...\n`);
    }

    let config;
    const testrunid = this.testrunid;

    return this.org
      .getConfig()
      .then(c => {
        config = c;
      })
      .then(() =>
        BBPromise.all([
          this.force.getAsyncTestResults(this.org, apexTestQueueItemIds), // gets individual test results
          this.force.getApexTestRunResult(this.org, testrunid) // gets summary info
        ])
      )
      .then(results => {
        this.testResults = new ApexTestResults(this, results[0].records, results[1].records, config);
      })
      .then(() => {
        if (this.codecoverage) {
          return this.retrieveApexCodeCoverage();
        }
        return undefined;
      })
      .then(coverage => {
        this.testResults.coverage = coverage;
      })
      .then(() => this.logTestArtifacts())
      .then(() => {
        if (this.waitForResults) {
          return this.reporter.emit('finished', this.testResults);
        }
        return BBPromise.resolve();
      })
      .then(() => {
        const json = this.testResults.toJson();
        // Check if it was kicked off via runTest
        if (_.isFunction(this.finishResolve)) {
          return this.finishResolve(json);
        } else {
          return json;
        }
      })
      .catch(err => {
        err['name'] = 'TestResultRetrievalFailed';
        this.messages.getMessage('apexReportCommandTestResultRetrievalFailed', [this.testrunid, err.message]);
        throw err;
      });
  }

  /**
   * Log test results to the console and/or the filesystem depending on the options
   */
  logTestArtifacts() {
    // write test results files - junit and json
    if (this.hasOutputDirectory()) {
      return BBPromise.resolve()
        .then(() => {
          // Write junit file
          const junit = {
            format: 'junit',
            file: path.join(
              this.outputdir,
              this.testrunid
                ? `${TEST_RESULT_FILE_PREFIX}-${this.testrunid}-junit.xml`
                : `${TEST_RESULT_FILE_PREFIX}-junit.xml`
            )
          };
          this.files.push(junit);
          return writeFile(junit.file, this.testResults.generateJunit());
        })
        .then(() => {
          // Write JSON file
          const json = {
            format: 'json',
            file: path.join(
              this.outputdir,
              this.testrunid ? `${TEST_RESULT_FILE_PREFIX}-${this.testrunid}.json` : `${TEST_RESULT_FILE_PREFIX}.json`
            )
          };
          this.files.push(json);
          return writeFile(json.file, JSON.stringify(this.testResults.toJson(), null, 4));
        })
        .then(() => {
          if (this.codecoverage && this.testResults.coverage && this.testResults.coverage.coverage) {
            // Write JSON file
            const json = {
              format: 'json',
              file: path.join(this.outputdir, `${TEST_RESULT_FILE_PREFIX}-codecoverage.json`)
            };
            this.files.push(json);
            return writeFile(json.file, JSON.stringify(this.testResults.coverage.coverage, null, 4));
          }
          return BBPromise.resolve();
        })
        .then(() => {
          this.reporter.logTable('Test Reports', this.files, [
            { key: 'format', label: 'Format' },
            { key: 'file', label: 'File' }
          ]);
        });
    }
    return BBPromise.resolve();
  }

  /**
   * Apex code coverage has a record for each test method invoked multiplied by the
   * apex class or triggers executed in those tests. This method iterates over
   * all those records to determine the code coverage per class and trigger.
   *
   * For example, it we have testMethod1 that executes code on classA and classB, and
   * testMethod2 that executes code on classA, then there will be 3 apex code coverage
   * records: testMethod1.classA, testMethod1.classB, testMethod2.classA. That means
   * that the TOTAL lines covered in classA is an aggregate between the testMethod1
   * and testMethod2 coverage records.
   */
  retrieveApexCodeCoverage() {
    return this.force
      .getApexCodeCoverage(this.org)
      .then(coverageResponse => {
        const records = _.isArray(coverageResponse.records) ? coverageResponse.records : [];
        const coverageMap = {};
        const coverage = [];

        // This is a summary of the coverage info.  testRunCoverage, totalLines, and coveredLines
        // is for only the classes and triggers that were executed by the tests.  orgWideCoverage
        // is the code coverage for all classes and triggers in the org.
        const summary = {
          totalLines: 0,
          coveredLines: 0,
          testRunCoverage: '0',
          orgWideCoverage: `${coverageResponse.orgWideCoverage}%`
        };

        // Combine coverage results to get coverage by class and trigger
        records.forEach(record => {
          const id = record.ApexClassOrTrigger.Id;
          const covered = record.Coverage.coveredLines;
          const uncovered = record.Coverage.uncoveredLines;
          const totalLines = record.NumLinesCovered + record.NumLinesUncovered;

          // If we haven't ran into the apex class or trigger yet, create a
          // new coverage record for it so we can aggregate all results
          if (!coverageMap[id]) {
            coverageMap[id] = {
              id,
              name: record.ApexClassOrTrigger.Name,
              totalLines,
              // Use a map to easily update lines with new test results
              // that come in for the same class or trigger
              lines: {},
              totalCovered: record.NumLinesCovered,
              coveredPercent: (covered.length / totalLines) * 100
            };
            coverage.push(coverageMap[id]);

            covered.forEach(line => {
              coverageMap[id].lines[line] = 1;
            });
            uncovered.forEach(line => {
              coverageMap[id].lines[line] = 0;
            });
            summary.totalLines += totalLines;
            summary.coveredLines += record.NumLinesCovered;
          } else {
            // We only have to update covered lines, since any future test
            // results on this apex can only improve the coverage
            covered.forEach(line => {
              if (!coverageMap[id].lines[line]) {
                coverageMap[id].lines[line] = 1;
                coverageMap[id].totalCovered++;
                summary.coveredLines++;
              }
            });

            // Update the total covered lines. The total covered lines is a
            // combination of all tests
            coverageMap[id].coveredPercent = Math.round((coverageMap[id].totalCovered / totalLines) * 100);
          }
        });
        summary.testRunCoverage = `${Math.floor((summary.coveredLines / summary.totalLines) * 100)}%`;

        return { coverage, records, summary };
      })
      .catch(err => {
        err['name'] = 'CodeCoverageRetrievalFailed';
        this.messages.getMessage('apexReportCommandCodeCoverageRetrievalFailed', [this.testrunid, err.message]);
        throw err;
      });
  }

  convertSynchronousResultsToApexTestResult(successes, failures) {
    const apexTestResults = [];
    const mapTestResultFields = function(result, outcome) {
      return {
        ApexClass: {
          attributes: {
            type: 'ApexClass'
          },
          Id: result.id,
          Name: result.name,
          NamespacePrefix: result.namespace
        },
        MethodName: result.methodName,
        Outcome: outcome,
        RunTime: result.time,
        Message: result.message,
        StackTrace: result.stackTrace
      };
    };
    if (Array.isArray(successes)) {
      successes.forEach(successResult => {
        apexTestResults.push(mapTestResultFields(successResult, 'Pass'));
      });
    }
    if (Array.isArray(failures)) {
      failures.forEach(failureResult => {
        apexTestResults.push(mapTestResultFields(failureResult, 'Fail'));
      });
    }
    return apexTestResults;
  }

  convertSynchronousResultsToRunSummary(result) {
    return {
      TestTime: result.totalTime
    };
  }
}

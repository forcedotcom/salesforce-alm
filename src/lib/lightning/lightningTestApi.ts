/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Force.com Continuous Integration CLI Test APIs to invoke tests and retrieve test results.
 *
 * $ force:lightning:test:run    - invokes tests of given Lightning test app name.
 *
 */

// ** external modules **
import * as _ from 'lodash';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import * as BBPromise from 'bluebird';
import * as moment from 'moment';
import * as webdriverio from 'webdriverio';

const mkdirp = BBPromise.promisify(require('mkdirp'));

const writeFile = BBPromise.promisify(fs.writeFile);

import logger = require('../core/logApi');
import * as almError from '../core/almError';
import Reporters = require('../test/reporter');
import TestResults = require('../test/testResults');
import SeleniumRunner = require('../test/seleniumRunner');
import OrgOpenCommand = require('../org/orgOpenCommand');
import { Dictionary } from '@salesforce/ts-types';
import messages = require('../messages');

const TEST_RESULT_FILE_PREFIX = 'lightning-test-result';
const DEFAULT_TIMEOUT = 60000;

/**
 * Lightning TAP reporter implementation.
 */
class LightningTestTapReporter extends Reporters.TapReporter {
  onStart(res) {
    if (res.tests && res.tests.length) {
      this.logTapStart(res.tests.length);
    }
  }

  async onFinished(res) {
    res.tests.forEach(test => {
      this.logTapResult(test);
    });
  }

  getFullTestName(testResult) {
    return testResult.FullName;
  }
}

/**
 * A list of the applicable reporter types
 */
const ReporterTypes = {
  human: Reporters.HumanReporter,
  tap: LightningTestTapReporter,
  json: Reporters.JsonReporter,
  junit: Reporters.JUnitReporter
};

/**
 *  A container for the lightning test results that provides helpers around formating
 *  and logging test results.
 */
class LightningTestResults extends TestResults {
  constructor(testApi, tests, runResultSummaries, config) {
    super(testApi.testrunid, testApi.startTime, 'force.lightning', tests, runResultSummaries, config);
  }

  getTestContainerName() {
    return '';
  }

  getTestNamespace(test) {
    return test.NamespacePrefix;
  }

  getTestName(test) {
    return test.FullName;
  }
}

class LightningTestApi {
  // TODO: proper property typing
  [property: string]: any;

  /**
   * The API class that manages running Lightning tests.
   *
   * @param org {object} The org for running tests.
   */
  constructor(org) {
    this.org = org;
    this.force = org.force;
    this.config = org.config;
    this.messages = messages();
    this.startTime = moment();
    this.logger = logger.child('lightning-test', { username: org.getName() });
    this.session = undefined;
  }

  /**
   * Create the output directory the the test results will be stored if doesn't exist
   */
  setupOutputDirectory() {
    const outputdir = this.outputdir;
    if (!util.isNullOrUndefined(outputdir)) {
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

  startSelenium(config = {}) {
    // start selenium here
    this.seleniumRunner = new SeleniumRunner();
    return this.seleniumRunner.start(config);
  }

  /**
   *
   * Initialize the test api to specify additional options and setup the
   * output directory if needed.
   *
   * @param {object} options The options used to run the tests. You can see a
   * list of valid options in the by looking at the defaults in the constructor.
   * @param {object} logger The logger object, which should typically be the
   * heroku cli.
   */
  initialize(options: Dictionary<any> = {}) {
    // Apply all the user defined setting (will override defaults)
    Object.assign(this, options);

    this.options = options;
    if (this.configfile) {
      this.configFileContent = JSON.parse(fs.readFileSync(this.configfile).toString('utf8'));
    }

    if (!this.resultformat) {
      this.resultformat = 'human';
    }

    // Validate the reporter
    const reporter = ReporterTypes[this.resultformat];
    if (!reporter) {
      return BBPromise.reject(
        almError(
          { keyName: 'lightningTestInvalidReporter', bundle: 'lightning_test' },
          Object.keys(ReporterTypes).join(',')
        )
      );
    } else if (this.resultformat === 'json') {
      // If the reporter is json, make sure the json flag is also set
      this.json = true;
      options.json = true;
    }

    this.reporter = new reporter(this.logger);

    return BBPromise.all([this.startSelenium(this.configFileContent), this.setupOutputDirectory()]);
  }

  /**
   * Run the specified tests.
   */
  runTests() {
    this.reporter.log(
      this.targetusername ? `Invoking Lightning tests using ${this.targetusername}...` : 'Invoking Lightning tests...'
    );

    // Default configs
    let driverOptions = {
      desiredCapabilities: {
        browserName: 'chrome'
      },
      host: 'localhost',
      port: 4444
    };

    const timeout = parseInt(this.options.timeout) || DEFAULT_TIMEOUT;
    let outputDivId = '#run_results_full';

    // Applying config file
    if (this.configFileContent != null) {
      if (this.configFileContent.webdriverio != null) {
        driverOptions = this.configFileContent.webdriverio;
      }

      if (this.configFileContent.outputDivId != null) {
        outputDivId = `#$${this.configFileContent.outputDivId}`;
      }
    }

    this.browser = webdriverio.remote(driverOptions);

    // Run lightning test apps with webdriverio and record results.
    return this.runTestAndExtractResults(outputDivId, timeout)
      .then(
        testResults => {
          if (testResults != null) {
            return this.retrieveAndStoreTestResults(testResults);
          }
          return BBPromise.reject(
            almError(
              {
                keyName: 'lightningTestResultRetrievalFailed',
                bundle: 'lightning_test'
              },
              ['Test results not found.']
            )
          );
        },
        err => BBPromise.reject(almError({ keyName: 'testRunError', bundle: 'lightning_test' }, [err.message]))
      )
      .finally(() =>
        BBPromise.resolve()
          .then(() => {
            if (this.session && !this.leavebrowseropen) {
              return this.browser.end();
            }

            return BBPromise.resolve(null);
          })
          .then(() => {
            if (this.seleniumRunner) {
              this.seleniumRunner.kill();
            }
          })
      );
  }

  // login and hit test app url; extract results from dom when complete
  runTestAndExtractResults(outputDivId, timeout) {
    let appname = `/c/${this.appname == null ? 'jasmineTests' : this.appname}`;
    if (appname.indexOf('.app') < 0) {
      appname += '.app';
    }

    return this.getFrontDoorUrl(appname)
      .then(urlInfo => this.startSessionWaitForDiv(urlInfo.url, appname, outputDivId, timeout))
      .then(() => this.extractTestResults(outputDivId))
      .then(testResultsStr => this.generateResultSummary(JSON.parse(testResultsStr)));
  }

  startSessionWaitForDiv(url, appname, outputDivId, timeout) {
    return this.browser.init().then(newSession => {
      this.session = newSession;
      logger.info(`Loading ${appname}...`);
      return this.browser.url(url).waitForExist(outputDivId, timeout);
    });
  }

  extractTestResults(outputDivId) {
    return this.browser.getHTML(outputDivId, false);
  }

  getFrontDoorUrl(appname) {
    // retrieving lightning test app url with credential params.
    const orgOpenCommand = new OrgOpenCommand();
    const context = {
      org: this.org,
      urlonly: true,
      path: appname
    };

    return orgOpenCommand
      .validate(context)
      .then(() => orgOpenCommand.execute(context))
      .then(urlInfo => urlInfo);
  }

  generateResultSummary(testResults) {
    const summary = {
      StartTime: this.startTime,
      TestTime: 0,
      TestExecutionTime: 0,
      UserId: '' // TODO
    };
    testResults.summary = [summary];

    // extract duration time for dom
    const durationTimeRegexp = new RegExp(/([0-9\.]+)/gi);

    return this.extractDuration().then(duration => {
      if (!util.isNullOrUndefined(duration)) {
        const parsedDuration = durationTimeRegexp.exec(duration);
        if (parsedDuration != null && parsedDuration.length > 0) {
          summary.TestTime = parseFloat(parsedDuration[0]) * 1000; // convert to ms
          summary.TestExecutionTime = summary.TestTime;
        }
      }

      return testResults;
    });
  }

  extractDuration() {
    return this.browser.getText('.jasmine-duration', true).catch(() => {
      /* ignore */
    });
  }

  /**
   * Retrieve the test results then store them by logging the test results
   * to the client and filesystem.
   */
  retrieveAndStoreTestResults(results) {
    this.reporter.log('Preparing test results...');

    return this.org
      .getConfig()
      .then(orgConfig => {
        this.lightningTestResults = new LightningTestResults(this, results.tests, results.summary, orgConfig);
        if (this.options.outputdir) {
          return this.logTestArtifacts();
        }

        return BBPromise.resolve();
      })
      .then(() => {
        if (this.reporter) {
          this.reporter.emit('start', this.lightningTestResults);
          this.reporter.emit('finished', this.lightningTestResults);
        }
      })
      .then(() => {
        this.reporter.log('Test run complete');

        const json = this.lightningTestResults.toJson();
        // Check if it was kicked off via runTest
        if (util.isFunction(this.finishResolve)) {
          return this.finishResolve(json);
        } else {
          return json;
        }
      })
      .catch(err => {
        err['name'] = 'TestResultRetrievalFailed';
        err['message'] = this.messages.getMessage(
          'lightningTestResultRetrievalFailed',
          [err.message],
          'lightning_test'
        );
        throw err;
      });
  }

  /**
   * Log test results to the console and/or the filesystem depending on the options
   */
  logTestArtifacts() {
    this.reporter.log(`Writing test results to files to ${this.outputdir}...`);

    // write test results files - junit and json
    if (util.isString(this.outputdir)) {
      let json;
      const files = [];

      // Write junit file
      const junit = {
        format: 'JUnit',
        file: path.join(this.outputdir, `${TEST_RESULT_FILE_PREFIX}-junit.xml`)
      };

      return writeFile(junit.file, this.lightningTestResults.generateJunit())
        .bind(this)
        .then(() => {
          files.push(junit);

          // Write JSON file
          json = {
            format: 'JSON',
            file: path.join(this.outputdir, `${TEST_RESULT_FILE_PREFIX}.json`)
          };
          return writeFile(json.file, JSON.stringify(this.lightningTestResults.toJson(), null, 4));
        })
        .then(() => {
          files.push(json);

          this.reporter.logTable('Test Reports', files, [
            { key: 'format', label: 'Format' },
            { key: 'file', label: 'File' }
          ]);
        });
    }

    return BBPromise.resolve();
  }
}

export = LightningTestApi;

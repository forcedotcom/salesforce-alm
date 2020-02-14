/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as fs from 'fs';

// 3pp
import * as mkdirp from 'mkdirp';
import * as BBPromise from 'bluebird';
import * as AdmZip from 'adm-zip';
import * as _ from 'lodash';

// Local
import CheckStatus = require('./mdapiCheckStatusApi');
import consts = require('../core/constants');
import logger = require('../core/logApi');
import * as almError from '../core/almError';
import Stash = require('../core/stash');
import messages = require('../messages');

const fsWriteFile = BBPromise.promisify(fs.writeFile);

const RETRIEVE_ERROR_EXIT_CODE = 1;

/**
 * API that wraps Metadata API to retrieve source defined by given or generated package.xml.
 *
 * @param force
 * @constructor
 */
class MdRetrieveReportApi {
  private org;
  private force;
  private logger;
  private _fsStatAsync;
  private isJsonOutput;

  public retrieveTargetPath?: string;

  constructor(org) {
    this.org = org;
    this.force = org.force;
    this.logger = logger.child('md-retrieve');
    this._fsStatAsync = BBPromise.promisify(fs.stat);
  }

  // retreive source from org
  report(options) {
    options.wait = +(options.wait === undefined || options.wait === null
      ? consts.DEFAULT_MDAPI_RETRIEVE_WAIT_MINUTES
      : options.wait);

    let reportPromise = BBPromise.resolve();

    // set the json flag on this for use by this._log
    this.isJsonOutput = options.json;

    this.retrieveTargetPath = this._resolvePath(options.retrievetargetdir);

    return reportPromise
      .then(() => this._checkStatus(options))
      .then(result => (result.done ? this._handleResult(options, result) : result))
      .catch(err => {
        if (err.message.toLowerCase().includes('polling time out')) {
          const waitTime = options.wait ? options.wait : consts.DEFAULT_MDAPI_RETRIEVE_WAIT_MINUTES;
          throw almError('mdapiCliWaitTimeExceededError', ['retrieve', waitTime]);
        } else {
          throw err;
        }
      });
  }

  // Only log a message if not using json output format
  _log(message) {
    if (!this.isJsonOutput) {
      this.logger.log(message);
    }
  }

  _checkStatus(options) {
    if (options.result && options.wait == 0 && !options.deprecatedStatusRequest) {
      options.result.timedOut = true;
      this._print.bind(this, options)(options.result);
      // this will always be a timeout condition since we never call CheckStatus.handleStatus()
      return options.result;
    }

    const org = this.org;
    return new CheckStatus(
      options.wait,
      consts.DEFAULT_MDAPI_POLL_INTERVAL_MILLISECONDS,
      this._print.bind(this, options),
      this.force.mdapiCheckRetrieveStatus.bind(org.force, org, options.jobid)
    ).handleStatus();
  }

  handleZipResult(options, result, mdApi) {
    try {
      fs.statSync(mdApi.retrieveTargetPath);
    } catch (err) {
      mkdirp.sync(mdApi.retrieveTargetPath);
    }

    // REVIEWME: expose zip file name as param?
    const zipFilename = 'unpackaged.zip';
    const retrieveTargetFile = `${mdApi.retrieveTargetPath}${path.sep}${zipFilename}`;

    // write zip to retrievetargetdir
    return fsWriteFile(retrieveTargetFile, result.zipFile, 'base64')
      .then(() => {
        this._log(`Wrote retrieve zip to ${retrieveTargetFile}.`);

        // Delete the zipFile so the contents are not output to json
        delete result.zipFile;
        result.zipFilePath = retrieveTargetFile;
      })
      .then(() => {
        if (options.unzip) {
          // extract zip in place
          const zip = new AdmZip(retrieveTargetFile);
          zip.extractAllTo(mdApi.retrieveTargetPath);
        }
      });
  }

  _handleResult(options, result) {
    if (!result.success) {
      const err = almError('mdapiRetrieveFailed', result.errorMessage);
      this._setExitCode(RETRIEVE_ERROR_EXIT_CODE);
      err['result'] = result; // We need this downstream
      return BBPromise.reject(err);
    }

    // write zip or extract zip to retrievetargetdir
    return this.handleZipResult(options, result, this).then(() => result);
  }

  _parsePackageNames(packagenames) {
    return packagenames
      .trim()
      .replace(/\s*,\s*/g, ',')
      .split(',');
  }

  _print(options, result) {
    if (!this.isJsonOutput) {
      this._log('');
      if (result.done) {
        if (result.success) {
          this.logger.styledHeader(this.logger.color.green('Result'));
        } else {
          this.logger.styledHeader(this.logger.color.red('Result'));
        }
      } else {
        this.logger.styledHeader(this.logger.color.yellow('Status'));
      }
      this._log(`Status:  ${result.status}`);
      this._log(`jobid:  ${result.id}`);

      const hasFiles = result.fileProperties && result.fileProperties.length;

      if (result.done && options.verbose) {
        // sort by type then filename then fullname
        const files = hasFiles
          ? _.chain(result.fileProperties)
              .sortBy([
                function(o) {
                  return o.fullName.toUpperCase();
                }
              ])
              .sortBy([
                function(o) {
                  return o.fileName.toUpperCase();
                }
              ])
              .sortBy([
                function(o) {
                  return o.type.toUpperCase();
                }
              ])
              .value()
          : [];
        this._log('');
        this.logger.styledHeader(this.logger.color.blue(`Component Retrieved [${files.length}]`));
        this.logger.table(files, {
          columns: [
            { key: 'type', label: 'Type' },
            { key: 'fileName', label: 'File' },
            { key: 'fullName', label: 'Name' },
            { key: 'id', label: 'Id' }
          ]
        });
      }

      if (result.timedOut) {
        this._log('');
        let flags = ` --jobid ${result.id} --retrievetargetdir ${options.retrievetargetdir}`;
        if (options.targetusername) {
          flags += ` --targetusername ${options.targetusername}`;
        }
        this._log(messages().getMessage('mdRetrieveCommandCliWaitTimeExceededError', [options.wait, flags]));
      }
      this._log('');
    }
    return result;
  }

  async validate(context) {
    const options = context.flags;
    const validationPromises = [];

    let stashedValues = await Stash.list(Stash.Commands.MDAPI_RETRIEVE);

    if (!options.jobid) {
      options.jobid = options.jobid || stashedValues.jobid;
      options.retrievetargetdir = options.retrievetargetdir || stashedValues.retrievetargetdir;
    }

    // validate required parameters after populating params from the stash.
    if (!options.jobid) return BBPromise.reject(almError('MissingRequiredParameter', 'jobid'));
    if (!options.retrievetargetdir) return BBPromise.reject(almError('MissingRequiredParameter', 'retrievetargetdir'));

    // Wait must be a number that is greater than zero or equal to -1.
    const validWaitValue = !isNaN(+options.wait) && (+options.wait === -1 || +options.wait >= 0);
    if (options.wait && !validWaitValue) {
      return BBPromise.reject(almError('mdapiCliInvalidWaitError'));
    }

    const retrieveTargetPath = this._resolvePath(options.retrievetargetdir);
    validationPromises.push(
      this._validatePath(
        retrieveTargetPath,
        data => data.isDirectory(),
        () => BBPromise.resolve(),
        almError('InvalidArgumentDirectoryPath', ['retrievetargetdir', retrieveTargetPath])
      ).catch(err => {
        // ignore PathDoesNotExist, it will create a directory if it doesn't already exist.
        if (err.name !== 'PathDoesNotExist') {
          return BBPromise.reject(err);
        }
        return BBPromise.resolve();
      })
    );

    return BBPromise.all(validationPromises).then(() => options);
  }

  // Accepts:
  //     pathToValidate: a file path to validate
  //     validationFunc: function that is called with the result of a fs.stat(), should return true or false
  //     successFunc:    function that returns a promise.
  //     error:          an Error object that will be thrown if the validationFunc returns false.
  // Returns:
  //     Successfull Validation: The result of a call to successFunc.
  //     Failed Validation:      A rejected promise with the specified error, or a PathDoesNotExist
  //                             error if the file read fails.
  _validatePath(pathToValidate, validationFunc, successFunc, error) {
    return this._fsStatAsync(pathToValidate)
      .then(data => {
        if (validationFunc(data)) {
          return successFunc();
        } else {
          return BBPromise.reject(error);
        }
      })
      .catch(err => {
        err = err.code === 'ENOENT' ? almError('PathDoesNotExist', pathToValidate) : err;
        return BBPromise.reject(err);
      });
  }

  _setExitCode(code) {
    process.exitCode = code;
  }

  _resolvePath(...args) {
    return path.resolve.apply(this, args);
  }
}

export = MdRetrieveReportApi;

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

// Local
import { Lifecycle, SfdxError, fs } from '@salesforce/core';
import * as ManifestCreateApi from '../source/manifestCreateApi';
import * as almError from '../core/almError';
import consts = require('../core/constants');
import logger = require('../core/logApi');
import StashApi = require('../core/stash');
import RetrieveReportApi = require('./mdapiRetrieveReportApi');
import { MetadataTransportInfo } from './mdApiUtil';

const Parser = require('fast-xml-parser');

export interface MdRetrieveOptions {
  retrievetargetdir?: string;
  unpackaged?: string;
  autoUpdatePackage?: boolean;
  rollbackOnError?: boolean;
  runTest?: boolean;
  unzip?: boolean;
  disableLogging?: boolean;
  json?: boolean;
  wait?: number;
  packagenames?: string;
  jobid?: number;
  apiversion?: string;
  singlepackage?: string;
}

/**
 * API that wraps Metadata API to retrieve source defined by given or generated package.xml.
 *
 * @param force
 * @constructor
 */
export class MdRetrieveApi {
  private org;
  private force;
  private logger;
  private _fsStatAsync;
  private isJsonOutput;
  public retrieveTargetPath;

  constructor(org) {
    this.org = org;
    this.force = org.force;
    this.logger = logger.child('md-retrieve');
    this._fsStatAsync = fs.stat;
  }

  // retrieve source from org
  async retrieve(options: MdRetrieveOptions) {
    options.wait = +(options.wait === undefined || options.wait === null
      ? consts.DEFAULT_MDAPI_RETRIEVE_WAIT_MINUTES
      : options.wait);
    // set target org, org other than workspace defined org
    const orgApi = this.org;
    let retrievePromise = Promise.resolve();

    // set the json flag on this for use by this._log
    this.isJsonOutput = options.json;

    this.retrieveTargetPath = this._resolvePath(options.retrievetargetdir);

    // emit pre retrieve event
    await Lifecycle.getInstance().emit('preretrieve', { packageXmlPath: options.unpackaged });

    if (!options.packagenames && !options.jobid) {
      retrievePromise = MdRetrieveApi._getPackageJson(this, options);
    }

    return retrievePromise
      .then((unpackagedJson) => this._formatRetrieveOptions(options, unpackagedJson))
      .then((retrieveOptions) => {
        // call mdapi to retrieve source
        this._log('Retrieving source...');
        return options.jobid
          ? { id: options.jobid, deprecatedStatusRequest: 'true' }
          : this.force.mdapiRetrieve(orgApi, retrieveOptions);
      })
      .then((result) => this._setStashVars(result, options))
      .then((result) => {
        options.jobid = result.id;
        options['deprecatedStatusRequest'] = result.deprecatedStatusRequest;
        options['result'] = result;
        // remap property state to status in the result object
        options['result'].status = result.state;
        return this._reportStatus(options);
      })
      .catch((err) => {
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

  // Some default options used by source pull and source retrieve.
  static getDefaultOptions(): MdRetrieveOptions {
    return {
      autoUpdatePackage: true,
      rollbackOnError: true,
      runTest: false,
      unzip: true,
      disableLogging: true,
      json: true,
    };
  }

  // generate json format of package.xml either from given
  // file or gen'd from workspace.   json is sent w/ retrieve request.
  static _getPackageJson(mdApi, options) {
    let packageXmlPath;
    let promise = Promise.resolve();

    if (options.unpackaged) {
      // fully qualify path to package.xml
      packageXmlPath = path.resolve(options.unpackaged);
    } else {
      // let create api default sourcedir to defaultArtifact dir
      promise = new ManifestCreateApi(mdApi.org)
        .execute({
          outputdir: mdApi.retrieveTargetPath,
          sourcedir: options.sourcedir,
        })
        .then((fileInfo) => {
          packageXmlPath = fileInfo.file;
        });
    }
    return promise
      .then(() => fs.readFile(packageXmlPath, 'utf8'))
      .then((unpackagedXml) => {
        try {
          // convert to json
          return Parser.parse(unpackagedXml, { explicitArray: false });
        } catch (err) {
          // wrap in SfdxError
          throw SfdxError.create('salesforce-alm', 'source', 'IllFormattedManifest', [`; ${err.message}`]);
        }
      })
      .then((unpackagedJson) => {
        const packageData = unpackagedJson.Package;
        delete packageData.$;
        return packageData;
      });
  }

  _reportStatus(options) {
    return new RetrieveReportApi(this.org).report(options);
  }

  _formatRetrieveOptions(options, unpackagedJson) {
    const retrieveOptions: any = {};

    retrieveOptions.apiVersion = Number(options.apiversion || this.force.config.getApiVersion());

    if (unpackagedJson) {
      retrieveOptions.unpackaged = unpackagedJson;
    }
    if (options.packagenames) {
      // ensure proper formatting and
      // convert packagenames to an array.
      retrieveOptions.packageNames = this._parsePackageNames(options.packagenames);
    }

    // convert possible undefined to false.
    retrieveOptions.singlePackage = !!options.singlepackage;

    return retrieveOptions;
  }

  _parsePackageNames(packagenames) {
    return packagenames
      .trim()
      .replace(/\s*,\s*/g, ',')
      .split(',');
  }

  async _setStashVars(result, options) {
    await StashApi.setValues(
      {
        jobid: result.id,
        retrievetargetdir: options.retrievetargetdir,
        targetusername: options.targetusername,
      },
      StashApi.Commands.MDAPI_RETRIEVE
    );

    return result;
  }

  validate(context) {
    const options = context.flags;
    const validationPromises = [];
    const willCreateManifestFromArtifact = options.sourcedir || (!options.packagenames && !options.unpackaged);
    let insideProjectWorkspace = true;

    try {
      this.org.config.getAppConfig();
    } catch (e) {
      insideProjectWorkspace = false;
    }
    // If we're outside of the workspace and a manifest will be created from the default artifact, we should throw an error.
    if (!insideProjectWorkspace && willCreateManifestFromArtifact) {
      return Promise.reject(almError('mdRetrieveCommandCliInvalidProjectError'));
    }

    try {
      MetadataTransportInfo.validateExclusiveFlag(options, 'sourcedir', 'unpackaged');
      MetadataTransportInfo.validateExclusiveFlag(options, 'packagenames', 'sourcedir');
      MetadataTransportInfo.validateExclusiveFlag(options, 'jobid', 'packagenames');
      MetadataTransportInfo.validateExclusiveFlag(options, 'packagenames', 'unpackaged');
      MetadataTransportInfo.validateExclusiveFlag(options, 'jobid', 'sourcedir');
      MetadataTransportInfo.validateExclusiveFlag(options, 'jobid', 'unpackaged');
      MetadataTransportInfo.validateExclusiveFlag(options, 'jobid', 'singlepackage');
    } catch (err) {
      return Promise.reject(err);
    }

    const currentApiVersion = this.force.config.getApiVersion();
    if (
      options.apiversion &&
      (isNaN(+options.apiversion) || +options.apiversion < 0 || +options.apiversion > currentApiVersion)
    ) {
      return Promise.reject(almError('mdRetrieveCommandCliInvalidApiVersionError', currentApiVersion));
    }

    // Wait must be a number that is greater than zero or equal to -1.
    const validWaitValue = !isNaN(+options.wait) && (+options.wait === -1 || +options.wait >= 0);
    if (options.wait && !validWaitValue) {
      return Promise.reject(almError('mdapiCliInvalidWaitError'));
    }

    if (options.packagenames) {
      const packageNamesArray = this._parsePackageNames(options.packagenames);
      if (options.singlepackage && packageNamesArray.length > 1) {
        return Promise.reject(almError('mdRetrieveCommandCliTooManyPackagesError', packageNamesArray.join(',')));
      }
    }

    if (options.sourcedir) {
      validationPromises.push(
        this._validatePath(
          options.sourcedir,
          (data) => data.isDirectory(),
          () => Promise.resolve(),
          almError('InvalidArgumentDirectoryPath', ['sourcedir', options.sourcedir])
        )
      );
    } else if (options.unpackaged) {
      validationPromises.push(
        this._validatePath(
          options.unpackaged,
          (data) => data.isFile(),
          () => Promise.resolve(),
          almError('InvalidArgumentFilePath', ['unpackaged', options.unpackaged])
        )
      );
    }

    const retrieveTargetPath = this._resolvePath(options.retrievetargetdir);
    validationPromises.push(
      this._validatePath(
        retrieveTargetPath,
        (data) => data.isDirectory(),
        () => Promise.resolve(),
        almError('InvalidArgumentDirectoryPath', ['retrievetargetdir', retrieveTargetPath])
      ).catch((err) => {
        // ignore PathDoesNotExist, it will create a directory if it doesn't already exist.
        if (err.name !== 'PathDoesNotExist') {
          return Promise.reject(err);
        }
        return Promise.resolve();
      })
    );

    return Promise.all(validationPromises).then(() => options);
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
      .then((data) => {
        if (validationFunc(data)) {
          return successFunc();
        } else {
          return Promise.reject(error);
        }
      })
      .catch((err) => {
        err = err.code === 'ENOENT' ? almError('PathDoesNotExist', pathToValidate) : err;
        return Promise.reject(err);
      });
  }

  _resolvePath(...args) {
    return path.resolve.apply(this, args);
  }
}

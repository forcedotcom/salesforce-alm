/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';
import * as os from 'os';

// Thirdparty
import * as BBPromise from 'bluebird';

// Local
import logger = require('../core/logApi');
import Messages = require('../messages');
const messages = Messages();

const DEFAULT_POLL_INTERVAL_MILLIS = 5000;
const DEFAULT_MAX_WAIT_IN_MINUTES = 0;

//
// Using this function instead of parseInt for reasons outlined in this post:
//
// http://stackoverflow.com/questions/4090518/what-is-the-difference-between-parseint-and-number
//
// Do not want '20px' to be accepted, parseInt would allow this.
//
const validateNumber = function (number, fieldName) {
  const theNumber = Number(`${number}`);

  if (isNaN(theNumber)) {
    throw new Error(messages.getMessage('package1VersionCreateCommandNotANumber', [fieldName, number]));
  }

  return theNumber;
};

const parseVersion = function (versionString) {
  let major = null;
  let minor = null;

  if (versionString) {
    const versionFields = versionString.split('.');
    if (versionFields.length === 2) {
      major = validateNumber(versionFields[0], 'majorVersion');
      minor = validateNumber(versionFields[1], 'minorVersion');
    } else {
      throw new Error(messages.getMessage('package1VersionCreateCommandInvalidVersion', [versionString]));
    }
  }

  return {
    major,
    minor,
  };
};

const requestFromContext = function (context) {
  const version = parseVersion(context.flags.version);

  return {
    MetadataPackageId: context.flags.packageid,
    VersionName: context.flags.name,
    Description: context.flags.description,
    MajorVersion: version.major,
    MinorVersion: version.minor,
    IsReleaseVersion: !!context.flags.managedreleased,
    ReleaseNotesUrl: context.flags.releasenotesurl,
    PostInstallUrl: context.flags.postinstallurl,
    Password: context.flags.installationkey,
  };
};

const Package1VersionCreateApi = function () {
  this.error = null;
  this.logger = logger.child('Package1VersionCreateApi');
  this.messages = messages;
};

/**
 * Wait for success or failure of package version creation.
 * The wait interval is an optional param w/ a default value.
 *
 * A timeout throws an Error.
 *
 * @param id
 * @param retries max number of waits
 *
 * @return promise
 */
Package1VersionCreateApi.prototype.poll = function (context, id, retries) {
  this.org = context.org;
  this.configApi = this.org.config;
  this.force = this.org.force;

  return this.force.toolingRetrieve(this.org, 'PackageUploadRequest', id).then((request) => {
    switch (request.Status) {
      case 'SUCCESS':
        return request;
      case 'IN_PROGRESS':
        if (retries > 0) {
          // poll/retry
          this.logger.log(`Package upload in progress. Waiting ${this.pollIntervalMillis / 1000} more seconds`);
          return BBPromise.delay(this.pollIntervalMillis).then(() => this.poll(context, id, retries - 1));
        } else {
          // Upload is still in progress. Return result so that we can tell the user to poll for the result manually
          return request;
        }
      case 'QUEUED':
        if (retries > 0) {
          // poll/retry
          this.logger.log(`Package upload is enqueued. Waiting ${this.pollIntervalMillis / 1000} more seconds`);
          return BBPromise.delay(this.pollIntervalMillis).then(() => this.poll(context, id, retries - 1));
        } else {
          // Upload is still in progress. Return result so that we can tell the user to poll for the result manually
          return request;
        }
      default: {
        if (request.Errors && request.Errors.errors && request.Errors.errors.length > 0) {
          const errorMessage = this.messages.getMessage(
            'package1VersionCreateCommandUploadFailure',
            request.Errors.errors.map((e) => e.message).join(os.EOL)
          );
          throw new Error(errorMessage);
        } else {
          const errorMessage = this.messages.getMessage('package1VersionCreateCommandUploadFailureDefault');
          throw new Error(errorMessage);
        }
      }
    }
  });
};

/**
 * Creates a new version of the Managed Package in the target org.
 *
 * @param context
 * @returns {*|promise}
 */
Package1VersionCreateApi.prototype.execute = function (context) {
  this.org = context.org;
  this.configApi = this.org.config;
  this.force = this.org.force;

  // Note: Poll interval is for internal testing only, not exposed in CLI help, should be null 99.99% of the time
  this.pollIntervalMillis = util.isNullOrUndefined(context.flags.pollinterval)
    ? DEFAULT_POLL_INTERVAL_MILLIS
    : validateNumber(context.flags.pollinterval * 1000, 'pollInterval');
  this.maximumWaitTime = util.isNullOrUndefined(context.flags.wait)
    ? DEFAULT_MAX_WAIT_IN_MINUTES
    : validateNumber(context.flags.wait, 'wait');
  this.maxPoll = (this.maximumWaitTime * 60000) / this.pollIntervalMillis;

  const request = requestFromContext(context);

  return this.force.toolingCreate(this.org, 'PackageUploadRequest', request).then((pkgUploadResult) => {
    if (pkgUploadResult.success) {
      const id = pkgUploadResult.id;
      return this.poll(context, id, this.maxPoll).then((uploadStatus) => ({
        Status: uploadStatus.Status,
        Id: uploadStatus.Id,
        MetadataPackageVersionId: uploadStatus.MetadataPackageVersionId,
        MetadataPackageId: uploadStatus.MetadataPackageId,
      }));
    } else {
      throw new Error(pkgUploadResult.errors);
    }
  });
};

export = Package1VersionCreateApi;

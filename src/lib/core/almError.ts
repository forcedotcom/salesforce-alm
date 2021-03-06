/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholely superceded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import * as _ from 'lodash';

import Messages = require('../messages');
const messages = Messages();

// Hash of error keys to error names
const ALMErrors = {
  dataImportFileNotFound: 'InvalidDataImport',
  dataImportFileUnknownContentType: 'InvalidDataImport',
  dataImportFileUnsupported: 'InvalidDataImport',
  dataImportTooManyFiles: 'InvalidDataImport',
  dataImportFileEmpty: 'InvalidDataImport',
  dataImportFileInvalidJson: 'InvalidDataImport',
  dataImportFileNotProvided: 'InvalidDataImport',
  dataImportFileNoRefId: 'InvalidDataImport',
  dataImportFailed: 'FailedDataImport',
  sourcePushFailed: 'DeployFailed',
  sourceConflictDetected: 'sourceConflictDetected',
  signupDuplicateSettingsSpecified: 'InvalidProjectWorkspace',
};

/*
 *  Error generator for all ALM errors.
 *  @param key {String} - The error message key.  Used to get the error message text via messages.getMessage()
 *                        and the error name from ALMErrors.
 *  @param tokens {String|Array} - The tokens for the error message.
 *  @returns {Error} - The appropriate Error based on provided key and tokens.
 */
const ALMError = (errorKey, errorTokens?, actionKey?, actionTokens?): Error & { [key: string]: any } => {
  const error = new Error();

  const _updateError = function (key, tokens, attribute) {
    if (_.isString(key)) {
      error[attribute] = messages.getMessage(key, tokens);
    } else {
      error[attribute] = messages.getMessage(key.keyName, tokens, key.bundle);
    }
  };

  _updateError(errorKey, errorTokens, 'message');

  if (!_.isNil(actionKey)) {
    _updateError(actionKey, actionTokens, 'action');
  }

  const key = _.isString(errorKey) ? errorKey : errorKey.keyName;
  error['name'] = ALMErrors[key] || key;

  return error;
};

export = ALMError;

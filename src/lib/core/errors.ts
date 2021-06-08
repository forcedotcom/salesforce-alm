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

import Messages = require('../messages');
const messages = Messages();

// @Todo Remove this file. Use almError.

// @todo remove Validation Error. It's too generic.
export function InvalidProjectWorkspace() {
  this.name = 'InvalidProjectWorkspace';
  this.code = this.name;
  this.message = messages.getMessage(this.name, this.code);
  this.stack = new Error().stack;
}
InvalidProjectWorkspace.prototype = Object.create(Error.prototype);
InvalidProjectWorkspace.prototype.constructor = InvalidProjectWorkspace;

// ----

export function MissingAppConfig() {
  this.name = 'MissingAppConfig';
  this.message = messages.getMessage(this.name);
  this.code = this.name;
}
MissingAppConfig.prototype = Object.create(Error.prototype);
MissingAppConfig.prototype.constructor = MissingAppConfig;

// ---

export function MissingRequiredParameter(paramName) {
  this.name = 'MissingRequiredParameter';
  this.message = messages.getMessage(this.name, [paramName]);
  this.code = this.name;
}
MissingRequiredParameter.prototype = Object.create(Error.prototype);
MissingRequiredParameter.prototype.constructor = MissingRequiredParameter;

// ---

export function InvalidParameter(paramName, reason) {
  this.name = 'InvalidParameter';
  this.message = messages.getMessage(this.name, [paramName, reason]);
  this.code = this.name;
}
InvalidParameter.prototype = Object.create(Error.prototype);
InvalidParameter.prototype.constructor = InvalidParameter;

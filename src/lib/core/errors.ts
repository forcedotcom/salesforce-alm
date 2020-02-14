/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

//----

export function MissingAppConfig() {
  this.name = 'MissingAppConfig';
  this.message = messages.getMessage(this.name);
  this.code = this.name;
}
MissingAppConfig.prototype = Object.create(Error.prototype);
MissingAppConfig.prototype.constructor = MissingAppConfig;

//----
// todo rename this to MissingHubConfig.
export function MissingClientConfig() {
  this.name = 'MissingClientConfig';
  this.message = messages.getMessage(this.name);
  this.code = this.name;
}
MissingClientConfig.prototype = Object.create(Error.prototype);
MissingClientConfig.prototype.constructor = MissingClientConfig;

//----

export function UndefinedLocalizationLabel(locale, label) {
  this.name = 'UndefinedLocalizationLabel';
  this.message = messages.getMessage(this.name, [label, locale]);
  this.code = this.name;
}
UndefinedLocalizationLabel.prototype = Object.create(Error.prototype);
UndefinedLocalizationLabel.prototype.constructor = UndefinedLocalizationLabel;

//-----

export function LoginServerNotFound(host, port) {
  this.name = 'LoginServerNotFound';
  this.message = messages.getMessage(this.name, [host, port]);
  this.code = this.name;
}
LoginServerNotFound.prototype = Object.create(Error.prototype);
LoginServerNotFound.prototype.constructor = LoginServerNotFound;

//-----

export function InvalidProjectDescriptor(attributeName) {
  this.name = 'InvalidProjectDescriptor';
  this.message = messages.getMessage(this.name, [attributeName]);
  this.code = this.name;
}
InvalidProjectDescriptor.prototype = Object.create(Error.prototype);
InvalidProjectDescriptor.prototype.constructor = InvalidProjectDescriptor;

//---
export function MissingScratchOrgNamespace() {
  this.name = 'MissingScratchOrgNamespace';
  this.message = messages.getMessage(this.name);
  this.code = this.name;
}
MissingScratchOrgNamespace.prototype = Object.create(Error.prototype);
MissingScratchOrgNamespace.prototype.constructor = MissingScratchOrgNamespace;

//---

export function MissingRequiredParameter(paramName) {
  this.name = 'MissingRequiredParameter';
  this.message = messages.getMessage(this.name, [paramName]);
  this.code = this.name;
}
MissingRequiredParameter.prototype = Object.create(Error.prototype);
MissingRequiredParameter.prototype.constructor = MissingRequiredParameter;

//---

export function InvalidParameter(paramName, reason) {
  this.name = 'InvalidParameter';
  this.message = messages.getMessage(this.name, [paramName, reason]);
  this.code = this.name;
}
InvalidParameter.prototype = Object.create(Error.prototype);
InvalidParameter.prototype.constructor = InvalidParameter;

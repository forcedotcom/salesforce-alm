/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const ENV_TYPES = {
  sandbox: 'sandbox',
  virtual: 'virtual',
  prototype: 'prototype',

  creatableTypes() {
    // The string '*' is appended to the default
    return [`${ENV_TYPES.sandbox}*`, ENV_TYPES.virtual, ENV_TYPES.prototype];
  },
};

export = ENV_TYPES;

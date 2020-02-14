/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const ENV_TYPES = {
  sandbox: 'sandbox',
  virtual: 'virtual',
  prototype: 'prototype',

  creatableTypes() {
    // The string '*' is appended to the default
    return [`${ENV_TYPES.sandbox}*`, ENV_TYPES.virtual, ENV_TYPES.prototype];
  }
};

export = ENV_TYPES;

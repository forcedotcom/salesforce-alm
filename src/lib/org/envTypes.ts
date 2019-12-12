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

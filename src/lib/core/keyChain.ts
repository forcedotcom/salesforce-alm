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

// Node
import * as _ from 'lodash';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import * as util from 'util';

// Thirdparty
import * as optional from 'optional-js';

// Local
import * as almError from './almError';
import consts = require('./constants');
import Messages = require('../messages');
const messages = Messages();
import srcDevUtil = require('./srcDevUtil');

const GET_PASSWORD_RETRY_COUNT = 3;

/**
 * contents for platform type
 * @type {{WINDOWS: string, DARWIN: string, LINUX: string, GENERIC_UNIX: string}}
 */
export const platforms = {
  WINDOWS: 'windows',
  DARWIN: 'darwin',
  LINUX: 'linux',
  GENERIC_UNIX: 'generic_unix',
  GENERIC_WINDOWS: 'generic_windows'
};

/**
 * Helper to reduce an array of cli args down to a presentable string for logging.
 * @param optionsArray - cli command args.
 * @private
 */
const _optionsToString = function(optionsArray) {
  return optionsArray.reduce((accum, element) => `${accum} ${element}`);
};

/**
 * Re-usable errors
 */
const _errors = {
  // a service name is not provided by the user
  serviceRequired: () => srcDevUtil.getError(messages.getMessage('keyChainServiceRequired'), 'ServiceRequired'),

  // an account name is not provided by the user. {os username}
  accountRequired: () => srcDevUtil.getError(messages.getMessage('keyChainAccountRequired'), 'AccountRequired'),

  setCredentialError: (stdout, stderr) =>
    srcDevUtil.getError(
      messages.getMessage('keyChainServiceCommandFailed', `${stdout} - ${stderr}`),
      'SetCredentialError'
    ),

  getCredentialError: (stdout, stderr) =>
    srcDevUtil.getError(
      messages.getMessage('keyChainServiceCommandFailed', `${stdout} - ${stderr}`),
      'GetCredentialError'
    ),

  passwordNotFoundError: (stdout?, stderr?) => {
    let message = messages.getMessage('keyChainPasswordNotFound');
    message += `\n${stdout} - ${stderr}`;
    return srcDevUtil.getError(message, 'PasswordNotFound');
  },

  userCanceledError: () => srcDevUtil.getError(messages.getMessage('keyChainUserCanceled'), 'user_canceled'),

  parseError: (stdout, stderr) => {
    let message = messages.getMessage('keyChainCredentialParseError');
    message += `\n${stdout} - ${stderr}`;
    return srcDevUtil.getError(message, 'SetCredentialParseError');
  }
};

/**
 * Helper to determine if a program is executable
 * @param mode - stats mode
 * @param gid - unix group id
 * @param uid - unix user id
 * @returns {boolean} true if the program is executable for the user. for windows true is always returned
 * @private
 */
const _isExe = (mode, gid, uid) => {
  if (process.platform === 'win32') {
    return true;
  }

  return Boolean(
    mode & parseInt('0001', 8) ||
      (mode & parseInt('0010', 8) && process.getgid && gid === process.getgid()) ||
      (mode & parseInt('0100', 8) && process.getuid && uid === process.getuid())
  );
};

/**
 * private helper to validate that a program exists on the files system and is executable
 * @param programPath - the absolute path of the program
 * @param fsIfc - the file system interface
 * @param isExeIfc - executable validation function
 * @private
 */
export const validateProgram = (programPath, fsIfc, isExeIfc) => {
  let noPermission;
  try {
    const stats = fsIfc.statSync(programPath);
    if (!isExeIfc(stats.mode, stats.gid, stats.uid)) {
      noPermission = new Error(`Can't execute ${programPath}.`);
      noPermission.name = 'CantExecuteError';
    }
  } catch (e) {
    const error = new Error(`Cant find required security software ${programPath}`);
    error['name'] = 'CantFindCredentialProgram';
    throw error;
  }

  if (!util.isNullOrUndefined(noPermission)) {
    throw noPermission;
  }
};

class KeychainAccess {
  // TODO: proper property typing
  [property: string]: any;

  /**
   * abstract prototype for general cross platform keychain interaction
   * @param osImpl - the platform impl for (linux, darwin, windows)
   * @param fsIfc - the file system interface
   * @constructor
   */
  constructor(osImpl, fsIfc) {
    this.osImpl = osImpl;
    this.fsIfc = fsIfc;
  }

  validateProgram() {
    return validateProgram(this.osImpl.getProgram(), this.fsIfc, _isExe);
  }

  /**
   * gets a password using the native program for credential management.
   * @param opts - options for the credential lookup
   * @param fn - callback function (err, password)
   * @param retryCount - used internally to track the number of retries for getting a password out of the keychain.
   */
  getPassword(opts, fn, retryCount) {
    if (util.isNullOrUndefined(opts.service)) {
      fn(_errors.serviceRequired());
      return;
    }

    if (util.isNullOrUndefined(opts.account)) {
      fn(_errors.accountRequired());
      return;
    }

    this.validateProgram();

    const credManager = this.osImpl.getCommandFunc(opts, spawn);

    let stdout = '';
    let stderr = '';

    credManager.stdout.on('data', data => {
      stdout += data;
    });
    credManager.stderr.on('data', data => {
      stderr += data;
    });

    credManager.on('close', code => {
      const currentCount = optional.ofNullable(retryCount).orElse(0);

      try {
        return this.osImpl.onGetCommandClose(code, stdout, stderr, opts, fn);
      } catch (e) {
        if (e.retry) {
          if (currentCount >= GET_PASSWORD_RETRY_COUNT) {
            throw srcDevUtil.getError(
              `Failed to get the password after ${GET_PASSWORD_RETRY_COUNT} reties.`,
              'RetryForGetPasswordError'
            );
          }
          return this.getPassword(opts, fn, currentCount + 1);
        } else {
          // if retry
          throw e;
        }
      }
    });

    credManager.stdin.end();
  }

  /**
   * sets a password using the native program for credential management.
   * @param opts - options for the credential lookup
   * @param fn - callback function (err, password)
   */
  setPassword(opts, fn) {
    if (util.isNullOrUndefined(opts.service)) {
      fn(_errors.serviceRequired());
      return;
    }

    if (util.isNullOrUndefined(opts.account)) {
      fn(_errors.accountRequired());
      return;
    }

    if (util.isNullOrUndefined(opts.password)) {
      fn(srcDevUtil.getError('A password is required', 'PasswordRequired'));
      return;
    }

    validateProgram(this.osImpl.getProgram(), this.fsIfc, _isExe);

    const credManager = this.osImpl.setCommandFunc(opts, spawn);

    let stdout = '';
    let stderr = '';

    credManager.stdout.on('data', data => {
      stdout += data;
    });
    credManager.stderr.on('data', data => {
      stderr += data;
    });

    credManager.on('close', code => this.osImpl.onSetCommandClose(code, stdout, stderr, opts, fn));

    credManager.stdin.end();
  }
}

/**
 * windows implementation
 *
 * uses the included credManScript
 *
 * @private
 */
const _windowsImpl = {
  credManPath: path.join(__dirname, '..', '..', '..', 'CredMan.ps1'),

  getProgram() {
    return path.join('C:', 'Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  },

  getProgramOptions(opts) {
    return [
      '-ExecutionPolicy',
      'ByPass',
      '-File',
      _windowsImpl.credManPath,
      '-GetCred',
      '-Target',
      opts.service,
      '-User',
      opts.account
    ];
  },

  getCommandFunc(opts, fn) {
    return fn(_windowsImpl.getProgram(), _windowsImpl.getProgramOptions(opts));
  },

  passwordRegex: /Password\s*:\s.*/,

  _filterPassword(passwordArray) {
    return passwordArray[0]
      .split(':')[1]
      .trim()
      .replace(/'/g, '');
  },

  _checkPasswordRegExResult(passwordArray) {
    return !util.isNullOrUndefined(passwordArray) && passwordArray instanceof Array;
  },

  onGetCommandClose(code, stdout, stderr, opts, fn) {
    const command = `${_windowsImpl.getProgram()} ${_optionsToString(_windowsImpl.getProgramOptions(opts))}`;

    if (code !== 0) {
      const error = _errors.getCredentialError(stdout, stderr);
      error['action'] = messages.getMessage('keychainGetCommandFailedAction', [os.userInfo().username, command]);
      fn(error);
    } else {
      const passwordLine = stdout.match(_windowsImpl.passwordRegex);
      if (_windowsImpl._checkPasswordRegExResult(passwordLine)) {
        const password = _windowsImpl._filterPassword(passwordLine);
        if (password.length > 0) {
          fn(null, password);
          return;
        }
      } else {
        const notFound = stdout.indexOf(opts.service) > -1 && stdout.indexOf('type was not found') > 0;

        if (notFound) {
          const error = _errors.passwordNotFoundError(stdout, stderr);
          error['action'] = messages.getMessage('keychainPasswordNotFoundAction', [command]);
          fn(error);
          return;
        }
      }

      const error = _errors.parseError(stdout, stderr);
      error['action'] = messages.getMessage('keychainPasswordNotFoundAction', [command]);
      fn(error);
    }
  },

  setProgramOptions(opts) {
    return [
      '-ExecutionPolicy',
      'ByPass',
      '-File',
      _windowsImpl.credManPath,
      '-AddCred',
      '-Target',
      opts.service,
      '-User',
      opts.account,
      '-Pass',
      opts.password
    ];
  },

  setCommandFunc(opts, fn) {
    return fn(_windowsImpl.getProgram(), _windowsImpl.setProgramOptions(opts));
  },

  onSetCommandClose(code, stdout, stderr, opts, fn) {
    if (code !== 0) {
      const error = _errors.setCredentialError(stdout, stderr);
      const command = `${_windowsImpl.getProgram()} ${_optionsToString(_windowsImpl.setProgramOptions(opts))}`;
      error['action'] = messages.getMessage('keychainSetCommandFailedAction', [os.userInfo().username, command]);
      fn(error);
    } else {
      const passwordLine = stdout.match(_windowsImpl.passwordRegex);
      if (_windowsImpl._checkPasswordRegExResult(passwordLine)) {
        const password = _windowsImpl._filterPassword(passwordLine);
        if (password.length > 0) {
          fn(null, password);
          return;
        }
      }

      const error = _errors.parseError(stdout, stderr);
      const command = `${_windowsImpl.getProgram()} ${_optionsToString(_windowsImpl.setProgramOptions(opts))}`;
      error['action'] = messages.getMessage('keychainPasswordNotFoundAction', [command]);
      fn(error);
    }
  }
};

export const windows = new KeychainAccess(_windowsImpl, fs);

/**
 * linux implementation
 *
 * uses libsecret
 *
 * @private
 */
const _linuxImpl = {
  getProgram() {
    return process.env.SFDX_SECRET_TOOL_PATH || path.join(path.sep, 'usr', 'bin', 'secret-tool');
  },

  getProgramOptions(opts) {
    return ['lookup', 'user', opts.account, 'domain', opts.service];
  },

  getCommandFunc(opts, fn) {
    return fn(_linuxImpl.getProgram(), _linuxImpl.getProgramOptions(opts));
  },

  onGetCommandClose(code, stdout, stderr, opts, fn) {
    if (code === 1) {
      const error = _errors.passwordNotFoundError(stdout, stderr);
      const command = `${_linuxImpl.getProgram()} ${_optionsToString(_linuxImpl.getProgramOptions(opts))}`;
      error['action'] = messages.getMessage('keychainPasswordNotFoundAction', [command]);

      // This is a workaround for linux.
      // Calling secret-tool too fast can cause it to return an unexpected error. (below)
      if (!util.isNullOrUndefined(stderr) && stderr.includes('invalid or unencryptable secret')) {
        error['retry'] = true;

        // Throwing here allows us to perform a retry in KeychainAccess
        throw error;
      }

      // All other issues we will report back to the handler.
      fn(error);
    } else {
      fn(null, stdout.trim());
    }
  },

  setProgramOptions(opts) {
    return ['store', "--label='salesforce.com'", 'user', opts.account, 'domain', opts.service];
  },

  setCommandFunc(opts, fn) {
    const secretTool = fn(_linuxImpl.getProgram(), _linuxImpl.setProgramOptions(opts));
    secretTool.stdin.write(`${opts.password}\n`);
    return secretTool;
  },

  onSetCommandClose(code, stdout, stderr, opts, fn) {
    if (code !== 0) {
      const error = _errors.setCredentialError(stdout, stderr);
      const command = `${_linuxImpl.getProgram()} ${_optionsToString(_linuxImpl.setProgramOptions(opts))}`;
      error['action'] = messages.getMessage('keychainSetCommandFailedAction', [os.userInfo().username, command]);
      fn(error);
    } else {
      fn(null);
    }
  }
};

export const linux = new KeychainAccess(_linuxImpl, fs);

/**
 * OSX implementation
 *
 * /usr/bin/security is a cli front end for OSX keychain.
 *
 * @private
 */
const _darwinImpl = {
  getProgram() {
    return path.join(path.sep, 'usr', 'bin', 'security');
  },

  getProgramOptions(opts) {
    return ['find-generic-password', '-a', opts.account, '-s', opts.service, '-g'];
  },

  getCommandFunc(opts, fn) {
    return fn(_darwinImpl.getProgram(), _darwinImpl.getProgramOptions(opts));
  },

  onGetCommandClose(code, stdout, stderr, opts, fn) {
    let err;

    if (code !== 0) {
      switch (code) {
        case 128:
          err = _errors.userCanceledError();
          err['name'] = 'user_canceled';
          break;
        default:
          err = _errors.passwordNotFoundError(stdout, stderr);
          err.action = messages.getMessage('keychainPasswordNotFoundAction', [
            `${_darwinImpl.getProgram()} ${_optionsToString(_darwinImpl.getProgramOptions(opts))}`
          ]);
      }
      fn(err, null);
      return;
    }

    // For better or worse, the last line (containing the actual password) is actually written to stderr instead of
    // stdout. Reference: http://blog.macromates.com/2006/keychain-access-from-shell/
    if (/password/.test(stderr)) {
      const password = stderr.match(/"(.*)"/, '')[1];
      fn(null, password);
    } else {
      const error = _errors.passwordNotFoundError(stdout, stderr);
      const command = `${_darwinImpl.getProgram()} ${_optionsToString(_darwinImpl.getProgramOptions(opts))}`;
      error['action'] = messages.getMessage('keychainPasswordNotFoundAction', [command]);
      fn(error);
    }
  },

  setProgramOptions(opts) {
    return ['add-generic-password', '-a', opts.account, '-s', opts.service, '-w', opts.password];
  },

  setCommandFunc(opts, fn) {
    return fn(_darwinImpl.getProgram(), _darwinImpl.setProgramOptions(opts));
  },

  onSetCommandClose(code, stdout, stderr, opts, fn) {
    if (code !== 0) {
      const error = _errors.setCredentialError(stdout, stderr);
      const command = `${_darwinImpl.getProgram()} ${_optionsToString(_darwinImpl.setProgramOptions(opts))}`;
      error['action'] = messages.getMessage('keychainSetCommandFailedAction', [os.userInfo().username, command]);
      fn(error);
    } else {
      fn(null);
    }
  }
};

export const darwin = new KeychainAccess(_darwinImpl, fs);

function _writeFile(opts, fn) {
  const obj = {
    service: opts.service,
    account: opts.account,
    key: opts.password
  };

  fs.writeJson(this.getSecretFile(), obj, writeError => {
    if (writeError) {
      fn(writeError);
    } else {
      fn(null, obj);
    }
  });
}

class GenericKeychainAccess {
  getSecretFile() {
    return path.join(srcDevUtil.getGlobalHiddenFolder(), 'key.json');
  }

  isValidFileAccess(cb) {
    // This call just ensures .sfdx exists and has the correct permissions.
    fs.mkdir(path.join(srcDevUtil.getGlobalHiddenFolder()), consts.DEFAULT_USER_DIR_MODE, () => {
      fs.stat(this.getSecretFile(), (_err, stats) => {
        !_.isNil(_err) ? cb(_err) : cb(null, stats);
      });
    });
  }

  getPassword(opts, fn) {
    // validate the file in .sfdx
    this.isValidFileAccess(fileAccessError => {
      // the file checks out.
      if (_.isNil(fileAccessError)) {
        // read it's contents
        fs.readJson(this.getSecretFile(), (readJsonErr, readObj) => {
          // read the contents successfully
          if (_.isNil(readJsonErr)) {
            // validate service name and account just because
            if (opts.service === readObj.service && opts.account === readObj.account) {
              fn(null, readObj.key);
            } else {
              // if the service and account names don't match then maybe someone or something is editing
              // that file. #donotallow
              fn(
                almError(
                  'genericUnixKeychainServiceAccountMismatch',
                  [this.getSecretFile()],
                  'genericUnixKeychainServiceAccountMismatchAction',
                  null
                )
              );
            }
          } else {
            fn(readJsonErr);
          }
        });
      } else {
        if (fileAccessError.code === 'ENOENT') {
          fn(_errors.passwordNotFoundError());
        } else {
          fn(fileAccessError);
        }
      }
    });
  }

  setPassword(opts, fn) {
    // validate the file in .sfdx
    this.isValidFileAccess(fileAccessError => {
      // if there is a validation error
      if (!_.isNil(fileAccessError)) {
        // file not found
        if (fileAccessError.code === 'ENOENT') {
          // create the file
          fs.ensureFile(this.getSecretFile(), ensureFileError => {
            if (!ensureFileError) {
              // set up the perms correctly
              fs.chmod(this.getSecretFile(), '600', chmodError => {
                // perms set so we can write the key
                if (_.isNil(chmodError)) {
                  _writeFile.call(this, opts, fn);
                } else {
                  fn(chmodError);
                }
              });
            } else {
              fn(ensureFileError);
            }
          });
        } else {
          fn(fileAccessError);
        }
      } else {
        // the existing file validated. we can write the updated key
        _writeFile.call(this, opts, fn);
      }
    });
  }
}

class GenericUnixKeychainAccess extends GenericKeychainAccess {
  isValidFileAccess(cb) {
    super.isValidFileAccess((err, stats) => {
      if (!_.isNil(err)) {
        cb(err);
      } else {
        const octalModeStr = (stats.mode & 0o777).toString(8);
        const EXPECTED_OCTAL_PERM_VALUE = '600';
        if (octalModeStr === EXPECTED_OCTAL_PERM_VALUE) {
          cb();
        } else {
          cb(
            almError('genericUnixKeychainInvalidPerms', null, 'genericUnixKeychainInvalidPermsAction', [
              this.getSecretFile(),
              EXPECTED_OCTAL_PERM_VALUE
            ])
          );
        }
      }
    });
  }
}

class GenericWindowsKeychainAccess extends GenericKeychainAccess {}

export const generic_unix = new GenericUnixKeychainAccess();
export const generic_windows = new GenericWindowsKeychainAccess();

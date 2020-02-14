/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholly superseded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import * as ResponseParser from './force-cli-responseParser';
import * as Messages from './force-cli-messages';
import { Command } from './force-cli-command';

import cli = require('heroku-cli-util');

// TODO Deprecate this file

export let errorMessage = function(msg: string): void {
  msg = checkIfFaultStringFromXml(msg);
  cli.error(cli.color.bold(Messages.get('ErrorError')) + msg);
};

export let exitWithMessage = function(msg: string): never {
  msg = checkIfFaultStringFromXml(msg);
  throw new Error(msg);
};

export let exitDisplayHelp = function(command: Command): never {
  cli.log('\n' + command.help);
  // @ts-ignore exit throws instead of returning any
  return cli.exit(1);
};

export let abort = function(): never {
  // @ts-ignore exit throws instead of returning any
  return cli.exit(1, cli.color.bold(Messages.get('ErrorAbort')));
};

/**
 * parses the xml faultstring if needed
 * exposed for unit testing
 * @param msg
 * @returns {string}
 */
export let checkIfFaultStringFromXml = function(msg: string): string {
  if (ResponseParser.hasFaultString(msg)) {
    return ResponseParser.getFaultString(msg);
  }
  return msg;
};

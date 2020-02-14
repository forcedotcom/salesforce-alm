/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import Command from './command';
import almError = require('./almError');
import * as _ from 'lodash';

abstract class VarargsCommand extends Command {
  keyValuePairs;

  constructor(name: string, readonly validators?: Function[]) {
    super(name);
  }

  async validate(context): Promise<any> {
    // If the ToolbeltCommand sets it, use it.
    if (context.varargs) {
      // All validation is handled in SfdxCommand
      this.keyValuePairs = context.varargs;
      return super.validate(context);
    }

    // Keep this around for unit test. Test can be removed when
    // classes are refactored or removed.

    // If this command requires variables, throw if none are provided.
    if (_.get(context, 'command.variableArgsRequired') && !_.get(context, 'args.length')) {
      throw almError({ keyName: 'ArgsRequired', bundle: 'varargs_command' }, []);
    }

    // validate the format of the varargs
    if (_.get(context, 'args.length')) {
      this.keyValuePairs = {};
      context.args.forEach(arg => {
        const split = arg.split('=');

        if (split.length !== 2) {
          throw almError({ keyName: 'InvalidArgsFormat', bundle: 'varargs_command' }, [arg]);
        }
        const [name, value] = split;

        if (this.keyValuePairs[name]) {
          throw almError({ keyName: 'DuplicateArgs', bundle: 'varargs_command' }, [name]);
        }

        if (_.get(this, 'validators.length')) {
          this.validators.forEach(validator => validator(name, value));
        }

        this.keyValuePairs[name] = value || undefined;
      });
    }

    return super.validate(context);
  }
}

export default VarargsCommand;

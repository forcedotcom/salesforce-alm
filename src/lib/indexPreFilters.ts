/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';

import * as projectDir from './core/projectDir';
import logger = require('./core/logApi');

/**
 * An array or command pre-filters functions that are passed the command
 * definition, the CLI context, and if the command is running in JSON
 * mode or not.
 */
export = {
  validateProjectDir(command) {
    if (command.requiresProject) {
      projectDir.getPath();
    }
  },

  showDeprecationWarnings(command, context) {
    context.warnings = context.warnings || [];

    if (_.toUpper(process.env.SFDX_PRECOMPILE_DISABLE) === 'TRUE') {
      const msg = logger.formatDeprecationWarning(
        'SFDX_PRECOMPILE_DISABLE',
        {
          version: 41,
          to: 'SFDX_PRECOMPILE_ENABLE=true to enable Apex pre-compilation.'
        },
        'environment variable'
      );
      logger.warnUser(context, msg);
    }

    if (_.toUpper(process.env.SFDX_DISABLE_ENCRYPTION) === 'TRUE') {
      const msg = logger.formatDeprecationWarning(
        'SFDX_DISABLE_ENCRYPTION',
        {
          version: 41,
          to: 'sfdx force:auth to re-authorize your orgs'
          // I wanted to create an enum for DeprecationTypes but string mappings are only supported in TS 2.4 and above.
        },
        'environment variable'
      );
      logger.warnUser(context, msg);
    }

    if (command.deprecated) {
      const msg = logger.formatDeprecationWarning(
        command.command ? `${command.topic}:${command.command}` : command.topic,
        command.deprecated,
        'command'
      );
      logger.warnUser(context, msg);
    } else if (context.flags) {
      _.each(command.flags, flag => {
        if (flag.deprecated && !_.isNil(context.flags[flag.name])) {
          const msg = logger.formatDeprecationWarning(flag.name, flag.deprecated, 'flag');
          logger.warnUser(context, msg);
        }
      });
    }
  }
};

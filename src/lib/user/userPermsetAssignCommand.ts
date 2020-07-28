/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import _ = require('lodash');
import almError = require('../core/almError');
import Alias = require('../core/alias');
import Command from '../core/command';
import User from './user';
import PermissionSetAssignment from './permissionSetAssignment';
import logApi = require('../core/logApi');

interface SuccessMsg {
  name: string;
  value: string;
}

interface FailureMsg {
  name: string;
  message: string;
}

/**
 * Assign a named Permission Set to a list of users, a specific user, or the default user.
 */
export class UserPermsetAssignCommand extends Command {
  private org;
  private usernames: string[];
  private readonly successes: SuccessMsg[];
  private readonly failures: FailureMsg[];

  constructor() {
    super('user:permset:assign');
    this.successes = [];
    this.failures = [];
  }

  async validate(context: any): Promise<any> {
    // verify we have an org.  can't do anything without an org
    if (!context.org) {
      throw almError({ keyName: 'noOrgProvided', bundle: 'generatePassword' });
    }

    this.org = context.org;

    return super.validate(context);
  }

  /**
   * executes the assign command
   * @param context - the cli context
   * @returns {Promise}
   */
  async execute(context: any): Promise<any> {
    if (context.flags && context.flags.onbehalfof && context.flags.onbehalfof.length > 0) {
      this.usernames = context.flags.onbehalfof.split(',').map(_.trim);
    } else if (this.org.usingAccessToken) {
      const force = this.org.force;
      const userInfo = await force.request(this.org, 'GET', '/services/oauth2/userinfo');
      this.usernames = [userInfo.preferred_username];
    } else {
      this.usernames = [this.org.getName()];
    }
    // Convert any aliases to usernames
    const aliases = await Alias.list();
    this.usernames = this.usernames.map(username => aliases[username] || username);

    let users: User[] = await User.fetchUsers(this.org, this.usernames);

    return Promise.all(
      users.map(user =>
        new PermissionSetAssignment(this.org)
          .create(user, context.flags.permsetname)
          .then(psa => {
            this.successes.push({
              name: user.getField('username'),
              value: context.flags.permsetname
            });
            return psa;
          })
          .catch(err => {
            this.failures.push({
              name: user.getField('username'),
              message: err.message
            });
          })
      )
    ).then(() => {
      return { successes: this.successes, failures: this.failures };
    });
  }

  getHumanSuccessMessage() {
    const uiLogger = logApi.child(this.loggerName);
    if (this.successes.length > 0) {
      uiLogger.styledHeader(uiLogger.color.blue('Permsets Assigned'));
      uiLogger.table(this.successes, {
        columns: [
          { key: 'name', label: 'Username' },
          { key: 'value', label: 'Permission Set Assignment' }
        ]
      });
    }

    if (this.failures.length > 0) {
      if (this.successes.length > 0) {
        uiLogger.log('');
      }

      uiLogger.styledHeader(uiLogger.color.red('Failures'));
      uiLogger.table(this.failures, {
        columns: [
          { key: 'name', label: 'Username' },
          { key: 'message', label: 'Error Message' }
        ]
      });
      // legacy error output, keep for --json continuity
      // but no error was ever thrown
      process.exitCode = 1;
    }
  }
}

export default UserPermsetAssignCommand;

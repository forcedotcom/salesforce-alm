/*
 * Copyright, 1999-2016, salesforce.com
 * All Rights Reserved
 * Company Confidential
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
  private successes: SuccessMsg[];
  private failures: FailureMsg[];

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
    this.usernames = _.map((_.get(context, 'flags.onbehalfof') || this.org.getName()).split(','), _.trim);

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
        columns: [{ key: 'name', label: 'Username' }, { key: 'value', label: 'Permission Set Assignment' }]
      });
    }

    if (this.failures.length > 0) {
      if (this.successes.length > 0) {
        uiLogger.log('');
      }

      uiLogger.styledHeader(uiLogger.color.red('Failures'));
      uiLogger.table(this.failures, {
        columns: [{ key: 'name', label: 'Username' }, { key: 'message', label: 'Error Message' }]
      });
    }
  }
}

export default UserPermsetAssignCommand;

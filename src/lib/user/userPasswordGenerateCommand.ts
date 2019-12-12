/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import _ = require('lodash');
import os = require('os');
import messages = require('../messages');
import almError = require('../core/almError');
import Alias = require('../core/alias');
import Command from '../core/command';
import User from './user';
import logApi = require('../core/logApi');

const { getMessage } = messages();

export class UserPasswordGenerateCommand extends Command {
  private org;
  private usernames: string[];
  private passwordData: PasswordData | PasswordData[];

  constructor() {
    super('user:password:generate');
  }

  async validate(context: any): Promise<any> {
    // verify we have an org.  can't do anything without an org
    if (!context.org) {
      throw almError({ keyName: 'noOrgProvided', bundle: 'generatePassword' });
    }

    // verify that the org is a scratch org
    return context.org
      .checkScratchOrg(context.flags.defaultdevhubusername)
      .then(() => {
        this.org = context.org;
      })
      .then(() => super.validate(context));
  }

  async execute(context: any): Promise<any> {
    this.usernames = _.map((_.get(context, 'flags.onbehalfof') || this.org.getName()).split(','), _.trim);

    // Convert any aliases to usernames
    const aliases = await Alias.list();
    this.usernames = this.usernames.map(username => aliases[username] || username);

    let users: User[] = await User.fetchUsers(this.org, this.usernames);

    // Generate and set passwords for all users
    try {
      users = await Promise.all(users.map(user => user.assignPassword()));
    } catch (err) {
      if (_.includes(err.message, 'Cannot set password for self')) {
        err['action'] = getMessage('noSelfSetAction', [], 'generatePassword');
      }
      throw err;
    }

    // Build the password data object/array to return
    this.passwordData =
      users.length === 1
        ? { password: users[0].password }
        : users.map(user => ({
            username: user.getField('username'),
            password: user.password
          }));

    return Promise.resolve(this.passwordData);
  }

  getHumanSuccessMessage(pwdData): void {
    const uiLogger = logApi.child(this.loggerName);
    if (pwdData.password) {
      const successMsg = getMessage('success', [pwdData.password, this.usernames[0]], 'generatePassword');
      const viewMsg = getMessage('viewWithCommand', [this.usernames[0]], 'generatePassword');
      uiLogger.log(`${successMsg}${os.EOL}${viewMsg}`);
    } else {
      uiLogger.log(getMessage('successMultiple', undefined, 'generatePassword'));
      const columnData = {
        columns: [{ key: 'username', label: 'USERNAME' }, { key: 'password', label: 'PASSWORD' }]
      };
      uiLogger.table(pwdData, columnData);
    }
  }
}

interface PasswordData {
  username?: string;
  password: string;
}

export default UserPasswordGenerateCommand;

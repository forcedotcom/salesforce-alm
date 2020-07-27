/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import _ = require('lodash');
import almError = require('../core/almError');
import Command from '../core/command';
import Alias = require('../core/alias');

import logApi = require('../core/logApi');
import { AuthFields, AuthInfo, Connection, Org } from '@salesforce/core';
import Crypto = require('../core/crypto');

export class UserDisplayCommand extends Command {
  private org: Org;

  constructor() {
    super('user:display');
  }

  async validate(context: any): Promise<any> {
    super.validate(context);

    // verify we have an org.  can't do anything without an org
    if (!context.org) {
      throw almError({ keyName: 'noOrgProvided', bundle: 'user_display' });
    }

    // verify that the org is a scratch org
    return context.org.checkScratchOrg(context.flags.defaultdevhubusername).then(() => {
      this.org = context.org;
    });
  }

  async execute(context: any): Promise<any> {
    const logger = await this.getLogger();
    this.org = await Org.create({ aliasOrUsername: context.org.name });
    await this.org.refreshAuth();
    const username: string = this.org.getUsername();
    const userAuthDataArray: AuthInfo[] = await this.org.readUserAuthFiles();
    // userAuthDataArray contains all of the Org's users AuthInfo, we just need the default or -u, which is in the username variable
    const userAuthData: AuthFields = userAuthDataArray.find(uat => uat.getFields().username === username).getFields();
    const conn: Connection = await this.org.getConnection();

    const profileNameQuery: string = `SELECT name FROM Profile WHERE Id IN (SELECT profileid FROM User WHERE username='${username}')`;
    const userQuery: string = `SELECT id FROM User WHERE username='${username}'`;

    let profileName: string = userAuthData.userProfileName;
    let userId: string = userAuthData.userId;
    try {
      // the user executing this command may not have access to the Profile sObject.
      if (!profileName) {
        profileName = _.get(await conn.query(profileNameQuery), 'records[0].Name');
      }
    } catch (err) {
      profileName = 'unknown';
      logger.debug(
        `Query for the profile name failed for username: ${username} with message: ${_.get(err, 'message')}`
      );
    }

    try {
      if (!userId) {
        userId = _.get(await conn.query(userQuery), 'records[0].Id');
      }
    } catch (err) {
      userId = 'unknown';
      logger.debug(`Query for the user ID failed for username: ${username} with message: ${_.get(err, 'message')}`);
    }

    const userData = {
      username,
      profileName,
      id: userId,
      orgId: this.org.getOrgId(),
      accessToken: conn.accessToken,
      instanceUrl: userAuthData.instanceUrl,
      loginUrl: userAuthData.loginUrl
    };

    const alias: string = await Alias.byValue(username);

    if (alias) {
      userData['alias'] = alias;
    }

    if (userAuthData.password) {
      const crypto = new Crypto();
      await crypto.init();
      userData['password'] = await crypto.decrypt(userAuthData.password);
    }

    return Promise.resolve(userData);
  }

  getHumanSuccessMessage(userData) {
    const uiLogger = logApi.child(this.loggerName);
    uiLogger.styledHeader(uiLogger.color.blue('User Description'));
    const columnData = {
      columns: [
        { key: 'key', label: 'Key' },
        { key: 'value', label: 'Value' }
      ]
    };
    const userDisplayData = _.chain(userData)
      .map((value, k) => {
        const key = _.map(_.kebabCase(k).split('-'), _.capitalize).join(' ');
        return { key, value };
      })
      .sortBy('key')
      .value();
    uiLogger.table(userDisplayData, columnData);
  }
}

export default UserDisplayCommand;

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import _ = require('lodash');
import messages = require('../messages');
import almError = require('../core/almError');
import Command from '../core/command';
import Alias = require('../core/alias');
import logApi = require('../core/logApi');
import { SfdxError } from '@salesforce/core';

const USER_QUERY = 'SELECT username, profileid, id FROM User';
const PROFILE_QUERY = 'SELECT id, name FROM Profile';

export class UserListCommand extends Command {
  private org;

  constructor() {
    super('user:list');
  }

  async validate(context: any): Promise<any> {
    await super.validate(context);

    // verify we have an org.  can't do anything without an org
    if (!context.org) {
      throw almError({ keyName: 'noOrgProvided', bundle: 'user_list' });
    }

    const devHubUserName = context.flags.targetdevhubusername;

    return context.org
      .checkScratchOrg(devHubUserName)
      .then(() => {
        this.org = context.org;
      })
      .catch(err => {
        const errorAction = messages().getMessage('action', [], 'generatePassword');

        if (err.name === 'NoOrgFound') {
          err['message'] = SfdxError.wrap(err).message = messages().getMessage(
            'defaultOrgNotFound',
            'defaultdevhubusername'
          );
          err['action'] = errorAction;
        }
        throw err;
      });
  }

  async execute(context: any): Promise<any> {
    const aliases = _.invert(await Alias.list());
    const userInfos = await this._buildUserInfos();
    const profileInfos = await this._buildProfileInfos();
    let userAuthData = await this.org.readUserAuthFiles();

    userAuthData = userAuthData.map(authData => ({
      defaultMarker: authData.scratchAdminUsername ? '' : '(A)',
      alias: aliases[authData.username] || '',
      username: authData.username,
      profileName: profileInfos[userInfos[authData.username].ProfileId],
      orgId: this.org.authConfig.orgId,
      accessToken: authData.accessToken,
      instanceUrl: authData.instanceUrl,
      loginUrl: authData.loginUrl,
      userId: userInfos[authData.username].Id
    }));

    return Promise.resolve(userAuthData);
  }

  getColumnData() {
    const uiLogger = logApi.child(this.loggerName);
    uiLogger.styledHeader(
      uiLogger.color.blue(messages().getMessage('usersInOrg', [this.org.authConfig.orgId], 'user_list'))
    );
    return [
      { key: 'defaultMarker', label: '' },
      { key: 'alias', label: 'ALIAS' },
      { key: 'username', label: 'USERNAME' },
      { key: 'profileName', label: 'PROFILE NAME' },
      { key: 'userId', label: 'USER ID' }
    ];
  }

  // Build a map of { [Username]: { ProfileId, Id } } for all users in the org
  private async _buildUserInfos() {
    const userRecords = _.get(await this.org.force.query(this.org, USER_QUERY), 'records');

    if (userRecords) {
      return userRecords.reduce((userInfo, { Username, ProfileId, Id }) => {
        userInfo[Username] = { ProfileId, Id };
        return userInfo;
      }, {});
    }
  }

  // Build a map of { [ProfileId]: ProfileName } for all profiles in the org
  private async _buildProfileInfos() {
    const profileRecords = _.get(await this.org.force.query(this.org, PROFILE_QUERY), 'records');

    if (profileRecords) {
      return profileRecords.reduce((profileInfo, { Id, Name }) => {
        profileInfo[Id] = Name;
        return profileInfo;
      }, {});
    }
  }
}

export default UserListCommand;

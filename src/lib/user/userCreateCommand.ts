/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import _ = require('lodash');
import fs = require('fs');
import messages = require('../messages');
import almError = require('../core/almError');
import srcDevUtil = require('../core/srcDevUtil');
import Org = require('../core/scratchOrgApi');
import Alias = require('../core/alias');
import VarargsCommand from '../core/varargsCommand';
import User from './user';

import logApi = require('../core/logApi');

interface SuccessMsg {
  name: string;
  value: string;
}

interface FailureMsg {
  name: string;
  message: string;
}

export class UserCreateCommand extends VarargsCommand {
  private user: User;
  private profileName: string;
  private org;
  private successes: SuccessMsg[];
  private failures: FailureMsg[];

  constructor() {
    super('user:create');
    this.successes = [];
    this.failures = [];
  }

  async validate(context: any): Promise<any> {
    // verify we have an org.  can't do anything without an org
    if (!context.org) {
      throw almError({ keyName: 'noOrgProvided', bundle: 'user_create' });
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
    const appLogger = await this.getLogger();
    this.user = new User(context.org);

    // Build the user config
    const { fields, generatepassword, permsets = [] } = await this._buildUserConfig(context);

    // Create the user
    await this.user.create(fields);
    this.successes.push({ name: 'User Creation', value: this.user.id });

    // Assign permission sets to the created user
    if (permsets.length) {
      try {
        await this.user.assignPermissionSets(permsets);
        this.successes.push({
          name: 'Permission Set Assignment',
          value: permsets.join()
        });
      } catch (err) {
        this.failures.push({
          name: 'Permission Set Assignment',
          message: err.message
        });
      }
    }

    // Create the initial auth info
    const authInfo: AuthInfo = this._buildAuthInfo();

    // Create a new scratch org config for this user
    const newUserOrg = new Org(this.org.force);
    newUserOrg.setName(authInfo.username);

    // Write the auth file for this user
    try {
      await this.org.force.authorizeAndSave(authInfo, newUserOrg);
      appLogger.info(`Authenticated new user: ${this.user.getField('username')} for org ${this.org.authConfig.orgId}`);
    } catch (err) {
      // If we can't auth as this user then save a user auth config without an access token (so user:display works) and continue
      appLogger.debug(
        `Could not authenticate with user: ${this.user.getField('username')} and profile: ${this.user.getField(
          'profileid'
        )} due to error: ${err.message}`
      );
      delete authInfo.refreshToken;
      await newUserOrg.saveConfig(Object.assign(authInfo, { accessToken: '<NO API ACCESS>' }), undefined);
    }

    // Generate and set a password if specified
    if (generatepassword) {
      try {
        await this.user.assignPassword();
        this.successes.push({
          name: 'Password Assignment',
          value: this.user.password
        });
      } catch (err) {
        this.failures.push({
          name: 'Password Assignment',
          message: err.message
        });
      }
    }

    // Write/update the <orgId>.json file to keep track of users in the org for later cleanup
    await this._updateOrgFile(authInfo.scratchAdminUsername);

    // Set the alias if specified
    if (context.flags.setalias) {
      await Alias.set(context.flags.setalias, this.user.getField('username'));
    }

    return Promise.resolve(Object.assign({ orgId: this.org.authConfig.orgId }, this.user.toJSON()));
  }

  // Builds a user config that merges properties from a definition file with any
  // key/value pairs specified on the command line.  Command line props override
  // those from the definition file.  Any missing required fields are generated
  // based on the specified or default username.
  private async _buildUserConfig(context: any): Promise<any> {
    const appLogger = await this.getLogger();
    const userDefFile = context.flags.definitionfile;
    let userConfig = {} as any;
    const config = {} as any;

    // Get config defined in the user definition file
    if (userDefFile) {
      userConfig = await srcDevUtil.readJSON(userDefFile);
    }
    // Command line props override config file props
    userConfig = Object.assign(srcDevUtil.toLowerCaseKeys(userConfig), srcDevUtil.toLowerCaseKeys(this.keyValuePairs));
    userConfig = await this._addDefaultProps(userConfig);

    //
    // Build a new config object that's easier to consume for execute()
    //
    const { permsets, generatepassword } = userConfig;
    if (permsets) {
      config.permsets = _.isString(permsets) ? permsets.split(',') : permsets;
      delete userConfig.permsets;
    }

    if (generatepassword) {
      config.generatepassword = generatepassword === true || generatepassword === 'true';
      delete userConfig.generatepassword;
    }

    delete userConfig.profilename;
    config.fields = userConfig;

    appLogger.debug('Creating user with config:', config);

    return config;
  }

  // Builds an auth object for this user to authenticate and save in a file in the global hidden directory.
  private _buildAuthInfo(): AuthInfo {
    const {
      orgId,
      instanceUrl,
      devHubUsername,
      loginUrl,
      clientId,
      clientSecret,
      privateKey,
      createdOrgInstance
    } = this.org.authConfig;

    const authInfo: AuthInfo = {
      orgId,
      instanceUrl,
      devHubUsername,
      loginUrl,
      createdOrgInstance: createdOrgInstance || 'utf8',
      username: this.user.getField('username'),
      userId: this.user.id,
      userProfileName: this.profileName,
      created: this.user.getField('createddate'),
      refreshToken: this.user.refreshToken,
      scratchAdminUsername: this.org.getName()
    };

    // Set the clientId, clientSecret, and privateKey of the admin user if they exist
    if (clientId) authInfo.clientId = clientId;
    if (clientSecret) authInfo.clientSecret = clientSecret;
    if (privateKey) authInfo.privateKeyFile = privateKey;

    return authInfo;
  }

  // Add any properties that are required by the User API and not specified by the CLI user.
  private async _addDefaultProps(userConfig): Promise<any> {
    const missingRequiredFields: string[] = _.difference(User.REQUIRED_FIELDS, Object.keys(userConfig));

    const appLogger = await this.getLogger();
    // Assign a profile ID
    if (missingRequiredFields.includes('profileid')) {
      this.profileName = userConfig.profilename || 'Standard User';
      appLogger.debug(`Querying org for profile name [${this.profileName}]`);
      const profileQuery = `SELECT id FROM profile WHERE name='${this.profileName}'`;
      const response = await this.org.force.query(this.org, profileQuery);
      userConfig.profileid = _.get(response, 'records[0].Id');

      if (!userConfig.profileid) {
        throw almError({ keyName: 'profileNameNotFound', bundle: 'user_create' }, this.profileName);
      }

      _.pull(missingRequiredFields, 'profileid');
    } else {
      // A profileID was provided so query for the profile name from the ID
      const profileQR = await this.org.force.query(
        this.org,
        `SELECT name FROM profile WHERE id='${userConfig.profileid}'`
      );
      this.profileName = _.get(profileQR, 'records[0].Name');
    }

    // Generate a unique username based on the specified or default scratch org admin's username
    if (missingRequiredFields.includes('username')) {
      const username = this.org.getName();
      appLogger.debug(`Setting default username based on username [${username}]`);
      userConfig.username = `${Date.now()}_${username}`;
      _.pull(missingRequiredFields, 'username');
    }

    // Fetch the user details for the specified or default username
    // to default any other required fields
    if (missingRequiredFields.length) {
      const missingFields = missingRequiredFields.join();
      const username = this.org.getName();
      appLogger.debug(`Querying org for username [${username}] to default missing required fields [${missingFields}]'`);
      const userQuery = `SELECT ${missingFields} FROM user WHERE username='${username}'`;
      const response = await this.org.force.query(this.org, userQuery);
      const userInfo = _.get(response, 'records[0]');
      delete userInfo.attributes;
      Object.assign(userConfig, srcDevUtil.toLowerCaseKeys(userInfo));
    }

    return userConfig;
  }

  // Creates or updates the org file in $HOME/.sfdx (<orgId>.json) with the newly created username and the
  // scratch org admin username to simplify org cleanup.
  private async _updateOrgFile(scratchAdminUsername: string): Promise<any> {
    const orgId = this.org.authConfig.orgId;
    const username = this.user.getField('username');
    const orgFileName = `${orgId}.json`;
    const orgFilePath = srcDevUtil.getGlobalFilePath(orgFileName);

    const appLogger = await this.getLogger();

    try {
      const orgFileExists = fs.existsSync(orgFilePath);
      const orgFileData = orgFileExists
        ? await srcDevUtil.readJSON(orgFilePath)
        : { usernames: [scratchAdminUsername] };
      orgFileData.usernames.push(username);
      await srcDevUtil.saveGlobalConfig(orgFileName, orgFileData);
      appLogger.info(`Updated org file: ${orgFileName} with new user: ${username}`);
    } catch (err) {
      appLogger.info(`Could not write new user data to org file: ${orgFileName} \n Error Message: ${err.message}`);
    }

    return Promise.resolve();
  }

  getHumanSuccessMessage(): string {
    const uiLogger = logApi.child(this.loggerName);
    const username = this.user.getField('username');
    const userId = this.user.id;
    const orgId = this.org.authConfig.orgId;
    const userCreatedSuccessMsg = messages().getMessage('success', [username, userId, orgId, username], 'user_create');

    if (this.failures.length) {
      uiLogger.styledHeader(uiLogger.color.yellow('Partial Success'));
      uiLogger.log(userCreatedSuccessMsg);
      uiLogger.log('');
      uiLogger.styledHeader(uiLogger.color.red('Failures'));
      uiLogger.table(this.failures, {
        columns: [
          { key: 'name', label: 'Action' },
          { key: 'message', label: 'Error Message' }
        ]
      });
    } else {
      return userCreatedSuccessMsg;
    }
  }
}

// TODO: it would be nice if this were a fully featured class.
interface AuthInfo {
  orgId: string;
  instanceUrl: string;
  devHubUsername: string;
  loginUrl: string;
  createdOrgInstance: string;
  username: string;
  created: string;
  refreshToken: string;
  userId?: string;
  userProfileName?: string;
  scratchAdminUsername?: string;
  clientId?: string;
  clientSecret?: string;
  privateKeyFile?: string;
  privateKey?: string;
  alias?: string;
  password?: string;
}

export default UserCreateCommand;

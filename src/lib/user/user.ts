/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import almError = require('../core/almError');
import logApi = require('../core/logApi');
import Org = require('../core/scratchOrgApi');
import _ = require('lodash');
import PermissionSetAssignment, { ReadablePermissionSet } from './permissionSetAssignment';
import * as moment from 'moment';
import srcDevUtil = require('../core/srcDevUtil');

// Endpoint for creating a SCIM user
const scimEndpoint = '/services/scim/v1/Users';

// SCIM user creation request headers
const scimHeaders = { 'auto-approve-user': 'true' };

const PASSWORD_LENGTH = 10;
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '1234567890';
// eslint-disable-next-line no-useless-escape
const SYMBOLS = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '[', ']', '|', '-'];
const ALL = [LOWER, UPPER, NUMBERS, SYMBOLS.join('')];

const rand = len => Math.floor(Math.random() * (len.length || len));

// Takes an array of strings, surrounds each string with single quotes, then joins the values.
// Used for building a query condition.
const singleQuoteJoin = arr => arr.map(val => `'${val}'`).join();

// See https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_user.htm
class User {
  private force;
  private logger;

  private _refreshToken: string;
  private _fields: any;
  private _permissionSetAssignments: PermissionSetAssignment[];
  private _password: string;

  // Required fields on User API
  static readonly REQUIRED_FIELDS: string[] = [
    'username',
    'lastname',
    'email',
    'alias',
    'timezonesidkey',
    'localesidkey',
    'emailencodingkey',
    'languagelocalekey',
    'profileid'
  ];

  static readonly isValidPassword = new RegExp(
    `^(?=.*[${LOWER}])(?=.*[${UPPER}])(?=.*[${NUMBERS}])(?=.*[${SYMBOLS.join('\\')}]).+$`
  );

  constructor(private org) {
    this._fields = {};
    this._permissionSetAssignments = [];
    this.force = org.force;
    this.logger = logApi.child('User');
  }

  // The user Id
  get id(): string {
    return this._fields.id;
  }

  // Returns whether this user has been created on the server, based on whether this object has an Id
  get isCreated(): boolean {
    return !!this.id;
  }

  get refreshToken(): string {
    return this._refreshToken;
  }

  get permissionSetAssignments(): ReadablePermissionSet[] {
    return this._permissionSetAssignments.map(p => p.get());
  }

  get password(): string {
    return this._password;
  }

  get fields(): any {
    return _.clone(this._fields);
  }

  // Get a user field
  getField(key: string): string {
    return this._fields[key.toLowerCase()];
  }

  // Set 1 or more user fields.  Does not update the user sobject on the server.
  setFields(fields = {} as object): User {
    this._fields = Object.assign(this._fields, srcDevUtil.toLowerCaseKeys(fields));
    return this;
  }

  // Send request to create User sobject via the SCIM API in the org specified using the fields provided.
  async create(fields = {} as object): Promise<User> {
    this._fields = srcDevUtil.toLowerCaseKeys(fields);
    const { username, email, lastname, profileid } = this._fields;
    const body = JSON.stringify({
      username,
      emails: [email],
      name: {
        familyName: lastname
      },
      nickName: username.substring(0, 40), // nickName has a max length of 40
      entitlements: [
        {
          value: profileid
        }
      ]
    });

    await this.force._getConnection(this.org, this.org.config).then(async conn => {
      const scimUrl = conn._normalizeUrl(scimEndpoint);

      if (conn.accessToken) {
        scimHeaders['Authorization'] = `Bearer ${conn.accessToken}`;
      }

      // Send the request to the SCIM API
      return conn._transport
        .httpRequest({
          method: 'POST',
          url: scimUrl,
          headers: scimHeaders,
          body
        })
        .then(response => {
          const respBody = JSON.parse(response.body);
          if (response.statusCode === 201) {
            // Set some user response data on this
            this._fields.id = respBody.id;
            this._fields.createddate = moment(respBody.meta.created)
              .valueOf()
              .toString();
            this._refreshToken = srcDevUtil.toLowerCaseKeys(response.headers)['auto-approve-user'];
          } else {
            // For Gacks, the error message is on response.body[0].message but for handled errors
            // the error message is on response.body.Errors[0].description.
            const errMessage =
              _.get(respBody, 'Errors[0].description') || _.get(respBody, '[0].message') || 'Unknown Error';

            // Provide a more user friendly error message for certain server errors.
            if (errMessage.includes('LICENSE_LIMIT_EXCEEDED')) {
              const profileQuery = `SELECT name FROM profile WHERE id='${profileid}'`;
              return this.force.query(this.org, profileQuery).then(profileQR => {
                const profileName = _.get(profileQR, 'records[0].Name');
                throw almError(
                  {
                    keyName: 'licenseLimitExceeded',
                    bundle: 'user_create'
                  },
                  profileName
                );
              });
            } else if (errMessage.includes('DUPLICATE_USERNAME')) {
              throw almError({ keyName: 'duplicateUsername', bundle: 'user_create' }, username);
            } else {
              throw new Error(errMessage);
            }
          }
        });
    });

    // Update the User with the rest of the fields
    await this.update(_.omit(this._fields, ['username', 'email', 'lastname', 'profileid', 'id', 'createddate']));

    return this;
  }

  // Retrieves the user object from the server and re-assigns all fields to the response
  async retrieve(userId: string) {
    const fields = await this.force.retrieve(this.org, 'User', userId);
    this._fields = srcDevUtil.toLowerCaseKeys(fields);

    return this;
  }

  // Updates the user object on the server and any changed fields
  async update(fields = {} as object): Promise<User> {
    fields = srcDevUtil.toLowerCaseKeys(fields);
    fields['Id'] = this.id;

    // Send the request to update the user on the server
    await this.force.update(this.org, 'User', fields);
    delete fields['Id'];
    this._fields = Object.assign(this._fields, fields);
    this.logger.debug(`Updated user: ${this.getField('username')} with fields: ${JSON.stringify(fields)}`);

    return this;
  }

  async assignPermissionSets(permsetNames: string[]): Promise<User> {
    if (!this.isCreated) {
      throw almError({ keyName: 'userNotCreated', bundle: 'user_create' }, 'assigning permission sets.');
    }

    this._permissionSetAssignments = await Promise.all(
      permsetNames.map(permsetName => new PermissionSetAssignment(this.org).create(this, permsetName))
    );
    this.logger.debug(`Assigned permission set(s): ${permsetNames} to user: ${this.getField('username')}`);
    return this;
  }

  /**
   * Set the password for this user and update the auth file.
   * @param {string} password - The new password.  Leave unassigned to generate a password.
   * @returns {Promise.<User>}
   */
  async assignPassword(password?: string): Promise<User> {
    if (!this.isCreated) {
      throw almError({ keyName: 'userNotCreated', bundle: 'user_create' }, 'generating a password.');
    }

    const connection = await this.force._getConnection(this.org, this.force.config);

    // Get the auth data for the user we're going to be setting the password,
    // not the admin config
    const userOrg = new Org(this.org.force);
    userOrg.setName(this.getField('username'));
    const orgConfig = await userOrg.getConfig();

    const pwd = password || User.generatePassword();
    await connection.soap.setPassword(this.id, pwd);
    this._password = pwd;
    this.logger.info(`Set password: ${pwd} for user: ${this.id}`);
    await userOrg.saveConfig(Object.assign(orgConfig, { password: pwd }), undefined);

    return this;
  }

  /**
   * Generate a password that can be used with User.assignPassword.
   * @returns {String} - the generated password
   */
  static generatePassword(): string {
    // Fill an array with random characters from random requirement sets
    const pass = Array(PASSWORD_LENGTH - ALL.length)
      .fill(1)
      .map(() => {
        const set = ALL[rand(ALL)];
        return set[rand(set)];
      });

    // Add at least one from each required set to meet minimum requirements
    ALL.forEach(set => {
      pass.push(set[rand(set)]);
    });

    return _.shuffle(pass).join('');
  }

  /**
   * Queries an org for fields of the provided usernames, then creates and returns User objects.
   *
   * @param {Org} org - the org where the users exist
   * @param {string[]} usernames - array of usernames to fetch
   * @param {string[]} fields - array of fields that should be returned by the query.  defaults to ['Id', 'Username'].
   * @returns {Promise.<User[]>} a Promise of an array of User objects.
   */
  static async fetchUsers(org, usernames: string[], fields: string[] = ['id', 'username']): Promise<User[]> {
    // Build the user query
    const condition =
      usernames.length === 1 ? `username='${usernames[0]}'` : `(username IN (${singleQuoteJoin(usernames)}))`;
    const query = `SELECT ${fields.join()} FROM User WHERE ${condition}`;

    // Query for the user records.  { Id, Username }
    const userRecords = _.get(await org.force.query(org, query), 'records');

    // Throw an error if not all users were found in the org
    if (usernames.length !== userRecords.length) {
      const usersNotFound: string[] = _.difference(usernames, _.map(userRecords, 'Username'));
      const errorConfig: string[] =
        usersNotFound.length === 1 ? ['userNotFound', usersNotFound[0]] : ['usersNotFound', usersNotFound.join()];
      const orgId = _.get(org, 'authConfig.orgId');
      throw almError({ keyName: errorConfig[0], bundle: 'generatePassword' }, [errorConfig[1], orgId]);
    }

    // Return an array of User objects
    return userRecords.map(userRec => new User(org).setFields(userRec));
  }

  toJSON(): any {
    const { permissionSetAssignments, password, fields } = this;
    const baseObj = password ? { password } : {};
    return Object.assign(baseObj, { permissionSetAssignments, fields });
  }
}

export default User;

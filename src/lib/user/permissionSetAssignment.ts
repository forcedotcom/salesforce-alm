/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import _ = require('lodash');
import logApi = require('../core/logApi');
import almError = require('../core/almError');
import srcDevUtil = require('../core/srcDevUtil');
import User from './user';

export interface ReadablePermissionSet {
  id: string;
  _fields: object;
  _permSetName: string;
}

//
// API for working with the PermissionSetAssignment SObject.
//
// https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_permissionsetassignment.htm
class PermissionSetAssignment {
  private force;
  private logger;

  private _permSetName: string;
  private _fields: any;

  constructor(private org) {
    this._fields = {};
    this.force = org.force;
    this.logger = logApi.child('PermissionSetAssignment');
  }

  get id(): string {
    return this._fields.id;
  }

  get isCreated(): boolean {
    return !!this.id;
  }

  get permSetName(): string {
    return this._permSetName;
  }

  get fields(): any {
    return _.clone(this._fields);
  }

  // Get a PermissionSetAssignment field
  getField(key: string): string {
    return this._fields[key.toLowerCase()];
  }

  parsePermissionSetString(permSetString: string) {
    const nsPrefixMatch = permSetString.match(/(\w+(?=__))(__)(.*)/);

    let nsPrefix, permSetName;
    if (nsPrefixMatch) {
      try {
        nsPrefix = nsPrefixMatch[1];
        permSetName = nsPrefixMatch[3];
        this.logger.debug(`Using namespacePrefix ${nsPrefix} for permission set ${permSetName}`);
      } catch (e) {
        // Don't fail if we parse wrong.
        this.logger.debug(e);
      }
    } else {
      permSetName = permSetString;
    }
    return { nsPrefix, permSetName };
  }

  // Send request to create a PermissionSetAssignment sobject in the specified org.
  async create(user: User, permSetString: string): Promise<PermissionSetAssignment> {
    const { nsPrefix, permSetName } = this.parsePermissionSetString(permSetString);

    let query = `SELECT Id FROM PermissionSet WHERE Name='${permSetName}'`;

    if (nsPrefix) {
      query += ` AND NamespacePrefix='${nsPrefix}'`;
    }

    const AssigneeId = (this._fields.assigneeid = user.id);
    this._permSetName = permSetName;

    try {
      const queryResponse = await this.force.query(this.org, query);
      const PermissionSetId = _.get(queryResponse, 'records[0].Id');

      if (!PermissionSetId) {
        if (nsPrefix) {
          throw almError({ keyName: 'assignCommandPermissionSetNotFoundForNSError' }, [permSetName, nsPrefix]);
        } else {
          throw almError({ keyName: 'assignCommandPermissionSetNotFoundError' }, permSetName);
        }
      }

      const createResponse = await this.force.create(this.org, 'PermissionSetAssignment', {
        AssigneeId,
        PermissionSetId
      });
      this._fields.id = createResponse.id;
      this._fields.permissionsetid = PermissionSetId;
    } catch (err) {
      if (err.errorCode === 'DUPLICATE_VALUE') {
        this.logger.info(err.message);
      }
      throw err;
    }
    return this;
  }

  // Retrieves the PermissionSetAssignment object from the server and re-assigns all fields to the response
  async retrieve(psaId: string) {
    const fields = await this.force.retrieve(this.org, 'PermissionSetAssignment', psaId);
    this._fields = srcDevUtil.toLowerCaseKeys(fields);

    return this;
  }

  get(): ReadablePermissionSet {
    return {
      id: this.id,
      _fields: this._fields,
      _permSetName: this._permSetName
    };
  }
}

export default PermissionSetAssignment;

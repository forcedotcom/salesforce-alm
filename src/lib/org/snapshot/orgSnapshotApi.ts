/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
import * as moment from 'moment';

import Messages = require('../../messages');
const messages = Messages();

export const ORG_SNAPSHOT_FIELDS = [
  'Id',
  'SnapshotName',
  'Description',
  'Status',
  'SourceOrg',
  'CreatedDate',
  'LastModifiedDate',
  'ExpirationDate',
  'LastClonedDate',
  'LastClonedById',
  'Error'
];
const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DATE_FORMAT = 'YYYY-MM-DD';
export const ORG_SNAPSHOT_COLUMNS = [
  { key: 'Id', label: 'Id' },
  { key: 'SnapshotName', label: 'SnapshotName' },
  { key: 'Status', label: 'Status' },
  { key: 'SourceOrg', label: 'Source Org Id' },
  {
    key: 'CreatedDate',
    label: 'Created Date',
    format: value => (value ? moment(value).format(DATETIME_FORMAT) : '')
  },
  {
    key: 'LastModifiedDate',
    label: 'Last Modified Date',
    format: value => (value ? moment(value).format(DATETIME_FORMAT) : '')
  },
  {
    key: 'ExpirationDate',
    label: 'Expiration Date',
    format: value => (value ? moment(value).format(DATE_FORMAT) : '')
  },
  {
    key: 'LastClonedDate',
    label: 'Last Cloned Date',
    format: value => (value ? moment(value).format(DATETIME_FORMAT) : '')
  },
  { key: 'LastClonedById', label: 'Last Cloned By Id' }
];
const LIST_QUERY = `SELECT ${ORG_SNAPSHOT_FIELDS.join(',')} FROM OrgSnapshot ORDER BY CreatedDate`;
const GET_QUERY_BY_ID = `SELECT ${ORG_SNAPSHOT_FIELDS.join(',')} FROM OrgSnapshot WHERE Id=\'%s\'`;
const GET_QUERY_BY_NAME = `SELECT ${ORG_SNAPSHOT_FIELDS.join(',')} FROM OrgSnapshot WHERE SnapshotName LIKE \'%s\'`;
export const PERM_QUERY = 'SELECT Id FROM OrgSnapshot LIMIT 1';
const CONTENT = 'metadatadata';
const ORG_SNAPSHOT = 'OrgSnapshot';
const ORG_SNAPSHOT_KEY_PREFIX = '0Oo';
const ORG_SNAPSHOT_NOT_SUPPORTED = `'${ORG_SNAPSHOT}' is not supported`;

/**
 * Org Snapshot Request.
 */
export interface OrgSnapshotRequest {
  SourceOrg: string;
  SnapshotName: string;
  Description: string;
  Content?: string;
}

/**
 * Org Snapshot Record.
 */
export interface OrgSnapshot extends OrgSnapshotRequest {
  Id: string;
  Status: string;
  LastClonedDate?: string;
  LastClonedById?: string;
  CreatedDate: string;
  LastModifiedDate: string;
  ExpirationDate?: string;
  Error?: string;
}

/**
 * Org Snapshot API
 */
export interface OrgSnapshotApi {
  create(request: OrgSnapshotRequest): Promise<OrgSnapshot>;
  delete(orgSnapshotIdOrName: string): Promise<OrgSnapshot>;
  get(orgSnapshotIdOrName: string): Promise<OrgSnapshot>;
  list(): Promise<OrgSnapshot[]>;
  mapDataToLabel(result: OrgSnapshot): ColumnData[];
}

export interface ColumnData {
  name: string;
  value: string;
}

/**
 * Org Snapshot API Implementation.
 */
export class OrgSnapshotApiImpl implements OrgSnapshotApi {
  public static async create(org): Promise<OrgSnapshotApi> {
    const api = new OrgSnapshotApiImpl(org);
    await api.checkOrgSnapshotPerm();
    return api;
  }

  private readonly devHubOrg;
  private force;

  // use create()
  private constructor(org) {
    this.devHubOrg = org;
    this.force = org.force;
  }

  /**
   * Create OrgSnapshot record and org export.
   *
   * @param {OrgSnapshotRequest} request
   * @returns {Promise<OrgSnapshot>}
   */
  public async create(request: OrgSnapshotRequest): Promise<OrgSnapshot> {
    request.Content = request.Content || CONTENT;

    let createResult;
    try {
      createResult = await this.force.create(this.devHubOrg, ORG_SNAPSHOT, request);
    } catch (err) {
      this.checkForNotSupported(err);
    }

    if (!createResult.success) {
      throw new Error(createResult.errors);
    }

    // retrieve to show status
    return this.get(createResult.id);
  }

  /**
   * Delete OrgSnapshot record and underlying export.
   *
   * @param {string} orgSnapshotIdOrName
   * @returns {Promise<OrgSnapshot>}
   */
  public async delete(orgSnapshotIdOrName: string): Promise<OrgSnapshot> {
    const orgSnapshotId = await this.getOrgSnapshotId(orgSnapshotIdOrName);

    let deleteResult;
    try {
      deleteResult = await this.force.delete(this.devHubOrg, ORG_SNAPSHOT, orgSnapshotId);
    } catch (err) {
      this.checkForNotSupported(err);
    }

    if (!deleteResult.success) {
      const errors =
        deleteResult.errors && deleteResult.errors.length > 0 ? deleteResult.errors.join(', ') : 'Unknown error';
      throw Error(`Unable to delete ${ORG_SNAPSHOT} with name '${orgSnapshotIdOrName}': ${errors}`);
    }

    return deleteResult;
  }

  /**
   * Get OrgSnapshot by given ID or name.
   *
   * @param {string} orgSnapshotIdOrName
   * @returns {Promise<OrgSnapshot>}
   */
  public async get(orgSnapshotIdOrName: string): Promise<OrgSnapshot> {
    const query = orgSnapshotIdOrName.startsWith(ORG_SNAPSHOT_KEY_PREFIX) ? GET_QUERY_BY_ID : GET_QUERY_BY_NAME;

    let queryResult;
    try {
      queryResult = await this.force.query(this.devHubOrg, util.format(query, orgSnapshotIdOrName));
    } catch (err) {
      this.checkForNotSupported(err);
    }

    if (!queryResult.records || !queryResult.records[0]) {
      throw Error(`${ORG_SNAPSHOT} with ID or name '${orgSnapshotIdOrName}' not found`);
    }

    return queryResult.records[0];
  }

  /**
   * Get OrgSnapshot records.
   *
   * @returns {Promise<OrgSnapshot[]>}
   */
  public async list(): Promise<OrgSnapshot[]> {
    try {
      const queryResult = await this.force.query(this.devHubOrg, LIST_QUERY);
      return queryResult.records ? queryResult.records : [];
    } catch (err) {
      this.checkForNotSupported(err);
    }
  }

  /**
   * Returns name-value pairs of column to data
   * @param result
   * @returns {ColumnData[]}
   */
  public mapDataToLabel(result: OrgSnapshot): ColumnData[] {
    return [
      { name: 'Id', value: result.Id },
      { name: 'Snapshot Name', value: result.SnapshotName },
      { name: 'Description', value: result.Description },
      { name: 'Status', value: result.Status },
      { name: 'Source Org', value: result.SourceOrg },
      {
        name: 'Expiration Date',
        value: result.ExpirationDate ? moment(result.ExpirationDate).format(DATE_FORMAT) : ''
      },
      {
        name: 'Last Cloned Date',
        value: result.LastClonedDate ? moment(result.LastClonedDate).format(DATETIME_FORMAT) : ''
      },
      { name: 'Last Cloned By', value: result.LastClonedById },
      {
        name: 'Created Date',
        value: moment(result.CreatedDate).format(DATETIME_FORMAT)
      },
      {
        name: 'Last Modified Date',
        value: moment(result.LastModifiedDate).format(DATETIME_FORMAT)
      }
    ];
  }

  private async getOrgSnapshotId(orgSnapshotIdOrName: string): Promise<string> {
    if (orgSnapshotIdOrName.startsWith(ORG_SNAPSHOT_KEY_PREFIX)) {
      return orgSnapshotIdOrName;
    } else {
      // retrieve ID
      const record = await this.get(orgSnapshotIdOrName);
      return record.Id;
    }
  }

  private async checkOrgSnapshotPerm(): Promise<void> {
    try {
      await this.force.query(this.devHubOrg, PERM_QUERY);
    } catch (err) {
      this.checkForNotSupported(err);
    }

    return Promise.resolve(null);
  }

  // inspects if error is lack of OrgSnapshot perm
  private checkForNotSupported(err): Error {
    if (err.message && err.message.includes(ORG_SNAPSHOT_NOT_SUPPORTED)) {
      throw new Error(messages.getMessage('snapshotNotEnabled', [], 'orgSnapshot'));
    } else {
      throw err;
    }
  }
}

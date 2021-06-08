/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as optional from 'optional-js';
import * as _ from 'lodash';
import { Messages, SfdxError, ConfigAggregator } from '@salesforce/core';
import { RecordResult } from 'jsforce';
import * as Force from '../core/force'; // eslint-disable-line global-require

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('salesforce-alm', 'org_shape');

/**
 * Shape API object, for all of your ShapeRepresentation needs
 *
 * @constructor
 * @param forceApi The force api
 * @param shapeOrg The org we'll be querying against
 */
class ShapeRepresentationApi {
  private force;
  private shapeOrg;

  constructor(forceApi, shapeOrg) {
    this.force = optional.ofNullable(forceApi).orElse(new Force());
    this.shapeOrg = shapeOrg;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async create(description = '') {
    return this.force
      .create(this.shapeOrg, 'ShapeRepresentation', {
        Description: description,
      })
      .catch((err) => {
        if (err.errorCode && err.errorCode === 'NOT_FOUND' && err['name'] === 'ACCESS_DENIED') {
          return Promise.reject(SfdxError.wrap(messages.getMessage('create_shape_command_no_crud_access')));
        } else {
          return Promise.reject(err);
        }
      });
  }

  /**
   * Delete all ShapeRepresentation records for the shapeOrg.
   *
   * @return List of SR IDs that were deleted
   */
  async deleteAll(): Promise<any> {
    let shapeIds = [];
    try {
      const result = await this.force.query(this.shapeOrg, 'SELECT Id FROM ShapeRepresentation');
      shapeIds = result.records.map((shape) => shape.Id);
    } catch (err) {
      if (err.errorCode && err.errorCode === 'INVALID_TYPE') {
        // ShapeExportPref is not enabled, or user does not have CRUD access
        return Promise.reject(SfdxError.wrap(messages.getMessage('delete_shape_command_no_access', shapeIds)));
      }
      // non-access error
      return Promise.reject(err);
    }

    return Promise.all(
      shapeIds.map(async (id) => {
        try {
          const delResult: RecordResult = await this.force.delete(this.shapeOrg, 'ShapeRepresentation', id);
          if (delResult.success) {
            return delResult.id;
          }
        } catch (err) {
          return Promise.reject(err);
        }
      })
    );
  }

  /**
   * Find all ShapeRepresentation records with a state of Active or InProgress.
   *
   * @return SOQL response or null
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async findShapesOrNull() {
    const query =
      "SELECT Id, Status, CreatedBy.Username, CreatedDate FROM ShapeRepresentation WHERE Status IN ( 'Active', 'InProgress' )";
    return this.force.query(this.shapeOrg, query).catch((err) => {
      if (err.errorCode && err.errorCode === 'INVALID_TYPE') {
        // ShapeExportPref is not enabled
        return Promise.resolve();
      }
      // some important error
      return Promise.reject(err);
    });
  }

  /**
   * Check if the ShapeExportPilot preference is enabled.
   */
  async isFeatureEnabled() {
    const aggregator = await ConfigAggregator.create();

    if (aggregator.getInfo('apiVersion').value < 48) {
      return this.isFeatureEnabledBefore48();
    } else {
      return this.isFeatureEnabledAfter48();
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async isFeatureEnabledBefore48() {
    const prefValue = this.force.toolingQuery(
      this.shapeOrg,
      `SELECT SettingValue FROM ${'OrganizationSettingsDetail'} WHERE SettingName = 'ShapeExportPref'`
    );

    // no records are returned if ShapeExportPilot perm is disabled
    return prefValue.then((value) => {
      const hasResults = _.get(value, 'totalSize', 0) > 0;
      const enabled = hasResults && _.get(value, 'records[0].SettingValue', false);
      return Promise.resolve(enabled);
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async isFeatureEnabledAfter48() {
    const prefValue = this.force.toolingQuery(
      this.shapeOrg,
      `SELECT IsShapeExportPrefEnabled FROM ${'DevHubSettings'}`
    );

    // no records are returned if ShapeExportPilot perm is disabled
    return prefValue.then((value) => {
      const hasResults = _.get(value, 'totalSize', 0) > 0;
      const enabled = hasResults && _.get(value, 'records[0].IsShapeExportPrefEnabled', false);
      return Promise.resolve(enabled);
    });
  }

  isShapeId(shapeId: string): boolean {
    if (shapeId == null) {
      return false;
    } // '==' handles both null and undefined

    return (
      shapeId.startsWith('3SR') &&
      shapeId.length >= 15 &&
      shapeId.length <= 18 &&
      shapeId.match(/^[0-9a-zA-Z]+$/) != null
    );
  }

  async getShapeRepresentation(shapeId: string) {
    if (this.isShapeId(shapeId)) {
      const query =
        "Select Id, Status, Edition, Features, Settings from ShapeRepresentation WHERE Id = '" + shapeId + "' ";
      return this.force.query(this.shapeOrg, query).catch((err) => Promise.reject(err));
    } else {
      return Promise.reject(SfdxError.wrap(messages.getMessage('shape_get_not_a_shape_id')));
    }
  }
}

export = ShapeRepresentationApi;

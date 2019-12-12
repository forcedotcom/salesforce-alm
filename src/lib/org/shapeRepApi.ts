/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as optional from 'optional-js';
import * as _ from 'lodash';
import * as Force from '../core/force'; // eslint-disable-line global-require
import * as almError from '../core/almError';
import { RecordResult } from 'jsforce';

/**
 * Shape API object, for all of your ShapeRepresentation needs
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

  async create(description = '') {
    return this.force
      .create(this.shapeOrg, 'ShapeRepresentation', {
        Description: description
      })
      .catch(err => {
        return Promise.reject(err);
      });
  }

  /**
   * Delete all ShapeRepresentation records for the shapeOrg.
   * @return List of SR IDs that were deleted
   */
  async deleteAll(): Promise<any> {
    let shapeIds = [];
    try {
      const result = await this.force.query(this.shapeOrg, 'SELECT Id FROM ShapeRepresentation');
      shapeIds = result.records.map(shape => {
        return shape.Id;
      });
    } catch (err) {
      if (err.errorCode && err.errorCode === 'INVALID_TYPE') {
        // ShapeExportPref is not enabled, or user does not have CRUD access
        return Promise.reject(almError({ keyName: 'noAccess', bundle: 'org_shape_delete' }, []));
      }
      // non-access error
      return Promise.reject(err);
    }

    return Promise.all(
      shapeIds.map(async id => {
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
   * @return SOQL response or null
   */
  async findShapesOrNull() {
    const query =
      "SELECT Id, Status, CreatedBy.Username, CreatedDate FROM ShapeRepresentation WHERE Status IN ( 'Active', 'InProgress' )";
    return this.force.query(this.shapeOrg, query).catch(err => {
      if (err.errorCode && err.errorCode === 'INVALID_TYPE') {
        // ShapeExportPref is not enabled
        return Promise.resolve();
      }
      // some important error
      return Promise.reject(err);
    });
  }

  private shapePermEntity = 'OrganizationSettingsDetail';
  
  /**
   * Check if the ShapeExportPilot preference is enabled.
   */
  async isFeatureEnabled() {
    const prefValue = this.force.toolingQuery(
      this.shapeOrg,
      `SELECT SettingValue FROM ${this.shapePermEntity} WHERE SettingName = 'ShapeExportPref'`
    );

    // no records are returned if ShapeExportPilot perm is disabled
    return prefValue.then(value => {
      const hasResults = _.get(value, 'totalSize', 0) > 0;
      const enabled = hasResults && _.get(value, 'records[0].SettingValue', false);
      return Promise.resolve(enabled);
    });
  }
}

export = ShapeRepresentationApi;

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import Command from '../core/command';

// Thirdparty
import * as _ from 'lodash';

import Messages = require('../messages');
const messages = Messages();
import srcDevUtil = require('../core/srcDevUtil');
import * as almError from '../core/almError';
import ShapeRepApi = require('./shapeRepApi');

/**
 * Command impl for force:org:shape:delete
 */
class OrgShapeDeleteCommand extends Command {
  private org;
  private shapeApi;

  constructor() {
    super('org:shape:delete');
  }

  /**
   * executes the delete command
   * @param context - the cli context
   * @returns {Promise}
   */
  async execute(context): Promise<any> {
    const orgData = await this.org.getConfig();
    const deletedShapeIds = await this.shapeApi.deleteAll();
    const results = { orgId: orgData.orgId, shapeIds: deletedShapeIds };
    return Promise.resolve(results);
  }

  /**
   * secondary validation for the cli.
   * @param context - the cli context.
   * @returns {Promise}
   */
  async validate(context): Promise<any> {
    // validate varargs
    await super.validate(context);

    this.org = context.org;
    const fixedContext = srcDevUtil.fixCliContext(context);
    const username = fixedContext.targetusername;

    // raise an error if the org does not have the feature enabled
    this.shapeApi = new ShapeRepApi(this.org.force, this.org);
    const enabled = await this.shapeApi.isFeatureEnabled();
    if (!enabled) {
      return Promise.reject(almError({ keyName: 'noAccess', bundle: 'org_shape_delete' }, [username]));
    }

    return Promise.resolve(fixedContext);
  }

  getHumanSuccessMessage(results) {
    if (_.isEmpty(results.shapeIds)) {
      return messages.getMessage('noShapesHumanSuccess', results.orgId, 'org_shape_delete');
    }
    return messages.getMessage('humanSuccess', results.orgId, 'org_shape_delete');
  }
}
export = OrgShapeDeleteCommand;

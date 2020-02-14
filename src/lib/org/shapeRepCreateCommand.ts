/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import VarargsCommand from '../core/varargsCommand';

import ShapeRepApi = require('./shapeRepApi');
import Messages = require('../messages');
const messages = Messages();

class ShapeRepCreateCommand extends VarargsCommand {
  private shapeApi;

  constructor() {
    super('orgshape:create');
  }

  /**
   * secondary validation from the cli interface. this is a protocol style function intended to be represented by other
   * commands
   * @param context - this cli context
   * @returns {Promise}
   */
  async validate(context): Promise<any> {
    // validate varargs
    await super.validate(context);

    // Make sure the Org has the ShapePilotPref enabled
    this.shapeApi = new ShapeRepApi(context.org.force, context.org);
    const enabled = await this.shapeApi.isFeatureEnabled();
    if (!enabled) {
      return Promise.reject(new Error(messages.getMessage('create_shape_command_no_access', null, 'org_shape')));
    }
  }

  async execute(context, stdinValues): Promise<any> {
    // Finally, create the org shape and record the response
    const response = await this.shapeApi.create();

    return response;
  }

  getHumanSuccessMessage(shape) {
    return messages.getMessage('create_shape_command_success', shape.id, 'org_shape');
  }
}

export = ShapeRepCreateCommand;

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import VarargsCommand from '../core/varargsCommand';

import ShapeRepApi = require('./shapeRepApi');
import { Messages, SfdxError } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('salesforce-alm', 'org_shape');

interface ShapeResult {
  shapeId: string;
  shapeFile: string;
  success: boolean;
  errors: [];
}

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
      return Promise.reject(new SfdxError(messages.getMessage('create_shape_command_no_access')));
    }
  }

  async execute(context, stdinValues): Promise<ShapeResult> {
    const logger = await this.getLogger();

    // example response: { id: '3SRxx0000004D6iGAE', success: true, errors: [] }
    const createShapeResponse = await this.shapeApi.create();

    if (createShapeResponse['success'] != true) {
      logger.error('Shape create failed', createShapeResponse['errors']);
      throw Promise.reject(new SfdxError(messages.getMessage('shape_create_failed_message')));
    }

    const shapeId = createShapeResponse['id'];

    var scratchDefFileName;

    return { shapeId: shapeId, shapeFile: scratchDefFileName, success: true, errors: [] };
  }

  getHumanSuccessMessage(shape) {
    const shapeFileName = shape.shapeFile;

    if (typeof shapeFileName != 'undefined' && shapeFileName) {
      return messages.getMessage('create_shape_command_success_file', [shape.shapeFile]);
    } else {
      return messages.getMessage('create_shape_command_success_id', [shape.shapeId]);
    }
  }
}

export = ShapeRepCreateCommand;

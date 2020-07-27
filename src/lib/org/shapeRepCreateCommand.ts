/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import VarargsCommand from '../core/varargsCommand';

import ShapeRepApi = require('./shapeRepApi');
import { SfdxProject, Messages, SfdxError } from '@salesforce/core';
import fs = require('fs');
import path = require('path');
import * as util from 'util';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('salesforce-alm', 'org_shape');


interface ShapeResult {
  shapeId: string;
  shapeFile: string;
  success: boolean;
  errors: [] 
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

    const fileArgument = context.flags.definitionfile;
    var scratchDefFileName;

    if (typeof fileArgument != 'undefined' ) { 
    //if ( fileArgument ) { 
      scratchDefFileName = await this._generateScratchDefFile(context, shapeId);
    }

   return { shapeId: shapeId, shapeFile: scratchDefFileName, success: true, errors: [] }
  }

  getHumanSuccessMessage(shape) {     

    const shapeFileName = shape.shapeFile;

    if( typeof shapeFileName != 'undefined' && shapeFileName ) {
      return messages.getMessage('create_shape_command_success_file', [shape.shapeFile]);
    } else {
      return messages.getMessage('create_shape_command_success_id', [shape.shapeId]);
    }
  }

  private async _generateScratchDefFile(context, shapeId) : Promise<string> {

    const shapeRecord = await this._retrieveShapeRecord(shapeId);
    let settingsJSON = JSON.parse(shapeRecord['Settings']);

    // remove the Shape Pref - it will cause an error without the Perm
    if( "orgPreferenceSettings" in settingsJSON
        && "shapeExportPref" in settingsJSON.orgPreferenceSettings
        && settingsJSON.orgPreferenceSettings.shapeExportPref ){
      delete settingsJSON.orgPreferenceSettings.shapeExportPref;
    }

    let shapeObject = { 
      'edition': shapeRecord['Edition'].toLowerCase(), 
      'features': shapeRecord['Features'].toLowerCase().split(";"),
      'settings': settingsJSON
    };

    let jsonShape = JSON.stringify(shapeObject, null, 2);

    const orgId = context.org.authConfig.orgId;

    const definitionFileArg = context.flags.definitionfile;

    const fileName = this._makeShapeFileName(definitionFileArg, shapeId, orgId);

    const fileNameAndPath = await this._makeShapeFilePathName(fileName);

    await this._writeJsonFile(fileNameAndPath, jsonShape);

    return fileName;
  }

  private async _retrieveShapeRecord(shapeId): Promise<any> {

    const logger = await this.getLogger();

    // We need to iterate until the status is correct or we timeout; Timeout is specified at 30 seconds in the wrapping command.
    let retryAttempts = 15;
    const retryPeriodInMS = 2e3;

    let retrieveShapeResponse = await this.shapeApi.getShapeRepresentation(shapeId);

    if (retrieveShapeResponse['totalSize'] != 1) {
      logger.error('Expected one shape record but found: ' + retrieveShapeResponse['totalSize']);
      throw Promise.reject(new SfdxError(messages.getMessage('shape_create_failed_message'))); 
    }

    while (retrieveShapeResponse['records'][0]['Status']! in ['Error', 'Active'] && retryAttempts > 0) {
      await new Promise((resolve) => setTimeout(() => resolve(), retryPeriodInMS));
      retrieveShapeResponse = await this.shapeApi.getShapeRepresentation(shapeId);
      retryAttempts -= 1;
    }

    if (retryAttempts <= 0) {
      logger.error('Shape retrieve timed out.');
      throw Promise.reject(new SfdxError(messages.getMessage('shape_create_failed_message'))); 
    }

    const shapeResult = retrieveShapeResponse['records'][0];
    if (shapeResult['Status'] != 'Active') {
      logger.error('Shape status was incorrect');
      throw Promise.reject(new SfdxError(messages.getMessage('shape_create_failed_message'))); 
    }

    return shapeResult;
  }

  private _makeShapeFileName(fileNameParameter: string, shapeId: string, orgId: string): string {
    let workingFileName: string = fileNameParameter;
    if (typeof workingFileName != 'undefined' && workingFileName) {
      workingFileName = workingFileName.replace(/^.*[\\\/]/, '');
    }
    if (typeof workingFileName == 'undefined' || !workingFileName) {
      const orgId15 = orgId.substring(0, 15);
      const shapeId15 = shapeId.substring(0, 15);
      workingFileName = orgId15 + '-' + shapeId15 + '-scratch-def.json';
    }
    if (!workingFileName.endsWith('-scratch-def.json')) {
      workingFileName += '-scratch-def.json';
    }
    return workingFileName;
  }

  private async _makeConfigPath(): Promise<string> {

    const project = await SfdxProject.resolve();
    const projectPath: string = project.getPath();

    return path.join(projectPath, '/config');
  }

  private async _makeShapeFilePathName(fileNameParameter: string): Promise<string> {

    const workingFileName: string = path.join(await this._makeConfigPath(), fileNameParameter);

    return workingFileName;
  }

  private async _writeJsonFile( fileNameAndPath: string, jsonContent:string) {

    const logger = await this.getLogger();
    const options = { flag: 'w' };

    const fsWriteFileAsync = util.promisify(fs.writeFile);

    try {
      await fsWriteFileAsync(fileNameAndPath, jsonContent, options);
    } catch (e) {
      logger.error('Shape file write failed');
      logger.error('... cause: ${e.message}');
      throw Promise.reject(new SfdxError(messages.getMessage('shape_create_failed_message'))); 
    }
  }
}

export = ShapeRepCreateCommand;

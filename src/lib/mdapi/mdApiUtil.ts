/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
    MDAPI utility. This is not complete. Adding this to move a REST deploy related method out of force.js
    We need to refactor code and probably move more MD common functionality here.
*/
import { AuthInfo, ConfigAggregator, Connection, SfdxError, Logger, Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);

export type MdapiDeployRecentValidationOptions = {
  validateddeployrequestid: string;
  wait?: number;
  rollbckonerror?: boolean;
  ignorewarnings?: boolean;
  soapdeploy?: boolean;
};

export type DeployOptions = {
  rollbackOnError?: boolean;
  testLevel?: string;
  runTests?: string[];
  autoUpdatePackage?: boolean;
  ignoreWarnings?: boolean;
  checkOnly?: boolean;
  singlePackage?: boolean;
};

export class MetadataConnection extends Connection {
  // TODO: A method should be added to jsforce for deployRecentValidation()
  async _mdapiSoapDeployRecentValidation(
    options: MdapiDeployRecentValidationOptions,
    connection: Connection
  ): Promise<string> {
    let result;
    result = await connection.metadata['_invoke']('deployRecentValidation', {
      validationId: options.validateddeployrequestid,
    });
    return result;
  }

  async _mdapiRestDeployRecentValidation(
    options: MdapiDeployRecentValidationOptions,
    connection: Connection
  ): Promise<string> {
    const validateddeployrequestid = options.validateddeployrequestid;
    const url = `${connection.instanceUrl.replace(
      /\/$/,
      ''
    )}/services/data/v${connection.getApiVersion()}/metadata/deployRequest`;
    const messageBody = JSON.stringify({
      validatedDeployRequestId: validateddeployrequestid,
    });
    const requestInfo = {
      method: 'POST',
      url,
      body: messageBody,
    };
    const requestOptions = { headers: 'json' };

    let result;
    try {
      result = await connection.request(requestInfo, requestOptions);
    } catch (err) {
      if (err.name === 'API_DISABLED_FOR_ORG') {
        throw SfdxError.create('salesforce-alm', 'mdapi_deploy', 'mdDeployCommandCliNoRestDeploy');
      } else {
        throw err;
      }
    }

    // Return the validatedeployrequestid for REST deploys to maintain parity with _mdapiSoapDeployRecentValidation()
    return result.id;
  }
}

// Get a @salesforce/core Connection, which extends jsforce.Connection.
export async function getMetadataConnection(orgApi: any): Promise<Connection> {
  const connection = await Connection.create({
    authInfo: await AuthInfo.create({
      username: orgApi.getName(),
    }),
  });
  return connection;
}

// metadata api deploy recent validation; options contains the validated job ID to deployed
export async function mdapiDeployRecentValidation(
  orgApi: any,
  options: MdapiDeployRecentValidationOptions
): Promise<any> {
  const connection = await this.getMetadataConnection(orgApi);
  const logger = await Logger.child('MdapiUtil');
  if (await MetadataTransportInfo.isRestDeploy(options)) {
    logger.debug('*** Deploying with REST ***');
    return MetadataConnection.prototype._mdapiRestDeployRecentValidation(options, connection);
  } else {
    logger.debug('*** Deploying with SOAP ***');
    return MetadataConnection.prototype._mdapiSoapDeployRecentValidation(options, connection);
  }
}

export class MetadataTransportInfo {
  static async isRestDeployWithWaitZero(options) {
    return (await MetadataTransportInfo.isRestDeploy(options)) && options.wait === 0;
  }
  // SOAP is the default unless:
  //   1. SOAP is NOT specified with the soapdeploy flag on the command &&
  //   2. The restDeploy SFDX config setting is set to "true".
  static async isRestDeploy(options) {
    const logger = await Logger.child('MetadataTransportInfo');
    // If soapdeploy flag is on the command, it takes precedence over other mechanisms (such as restDeploy config variable)
    // and SOAP  deploy is  enabled
    if (options.soapdeploy === true) {
      logger.debug('soapdeploy option === true.  Using SOAP');
      return false;
    }

    const aggregator = await ConfigAggregator.create();
    const restDeployConfig = aggregator.getPropertyValue('restDeploy');
    // aggregator property values are returned as strings
    if (restDeployConfig === 'true') {
      logger.debug('restDeploy SFDX config === true.  Using REST');
      return true;
    } else if (restDeployConfig === 'false') {
      logger.debug('restDeploy SFDX config === false.  Using SOAP');
    } else {
      logger.debug('soapdeploy option unset. restDeploy SFDX config unset.  Defaulting to SOAP');
    }

    return false;
  }

  static validateExclusiveFlag(options, param1, param2) {
    if (options[param1] && options[param2]) {
      throw SfdxError.create('salesforce-alm', 'mdapi_deploy', 'mdapiCliExclusiveFlagError', [param1, param2]);
    }
  }
}

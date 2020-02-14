/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
    MDAPI utility. This is not complete. Adding this to move a REST deploy related method out of force.js
    We need to refactor code and probably move more MD common functionality here.
*/
import { AuthInfo, Connection, SfdxError, Logger, Messages, ConfigAggregator } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);

import * as _ from 'lodash';
import { Config } from '../core/configApi';

export type MdapiDeployRecentValidationOptions = {
  validateddeployrequestid: string;
  wait?: number;
  rollbckonerror?: boolean;
  ignorewarnings?: boolean;
};

export type DeployOptions = {
  testLevel?: string;
  runTests?: string;
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
  ): Promise<any> {
    let result;
    try {
      result = await connection.metadata['_invoke']('deployRecentValidation', {
        validationId: options.validateddeployrequestid
      });
    } catch (err) {
      throw err;
    }
    return result;
  }

  async _mdapiRestDeployRecentValidation(
    options: MdapiDeployRecentValidationOptions,
    connection: Connection
  ): Promise<any> {
    const validateddeployrequestid = options.validateddeployrequestid;
    const url = `${connection.instanceUrl}/services/data/v${connection.getApiVersion()}/metadata/deployRequest`;
    const messageBody = JSON.stringify({
      validatedDeployRequestId: validateddeployrequestid
    });
    const requestInfo = {
      method: 'POST',
      url,
      body: messageBody
    };
    const requestOptions = { headers: 'json' };

    let body;
    try {
      body = await connection.request(requestInfo, requestOptions);
    } catch (err) {
      if (err.name === 'API_DISABLED_FOR_ORG') {
        throw SfdxError.create('salesforce-alm', 'mdapi_deploy', 'mdDeployCommandCliNoRestDeploy');
      } else {
        throw err;
      }
    }
    return body;
  }
}

// Get a @salesforce/core Connection, which extends jsforce.Connection.
export async function getMetadataConnection(orgApi: any): Promise<Connection> {
  const connection = await Connection.create({
    authInfo: await AuthInfo.create({
      username: orgApi.getName()
    })
  });
  connection.setApiVersion(new Config().getApiVersion());
  return connection;
}

//metadata api deploy recent validation; options contains the validated job ID to deployed
export async function mdapiDeployRecentValidation(
  orgApi: any,
  options: MdapiDeployRecentValidationOptions
): Promise<any> {
  let connection = await this.getMetadataConnection(orgApi);
  const restDeploy = await MetadataTransportInfo.isRestDeploy();
  if (restDeploy) {
    this.logger = await Logger.child('*** Deploying with REST ***');
    return MetadataConnection.prototype._mdapiRestDeployRecentValidation(options, connection);
  } else {
    return MetadataConnection.prototype._mdapiSoapDeployRecentValidation(options, connection);
  }
}

export class MetadataTransportInfo {
  static async isRestDeploy() {
    const aggregator = await ConfigAggregator.create();
    const restDeploy = aggregator.getPropertyValue('restDeploy');
    return restDeploy && restDeploy.toString() === 'true';
  }

  static async isRestDeployWithWaitZero(options) {
    const restDeploy = await this.isRestDeploy();
    return restDeploy && options.wait === 0;
  }

  static validateExclusiveFlag(options, param1, param2) {
    if (options[param1] && options[param2]) {
      throw SfdxError.create('salesforce-alm', 'mdapi_deploy', 'mdapiCliExclusiveFlagError', [param1, param2]);
    }
  }
}

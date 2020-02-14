/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import MdapiDeployApi = require('./mdapiDeployApi');

/**
 * Command implementation that uses mdapiDeployApi to deploy source - directory or zip - to given org.
 */
class MetadataDeployCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor(context) {
    this.mdDeploy = new MdapiDeployApi(context.org);
  }

  validate(context) {
    return this.mdDeploy.validate(context);
  }

  execute(context) {
    return this.mdDeploy.deploy(context);
  }
}

export = MetadataDeployCommand;

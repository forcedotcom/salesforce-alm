/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import MdapiDeployApi = require('./mdapiDeployApi');

/**
 * Command implementation that uses mdapiDeployApi to deploy source - directory or zip - to given org.
 */
class MetadataDeployCommand {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
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

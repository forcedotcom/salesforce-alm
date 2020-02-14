/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MdRetrieveApi } from './mdapiRetrieveApi';

/**
 * Command implementation that uses mdapiDeployApi * API to retrieve source defined by given or generated package.xml.
 */
class MetadataRetrieveCommand {
  private mdRetrieve;

  constructor(context) {
    this.mdRetrieve = new MdRetrieveApi(context.org);
  }

  validate(context) {
    return this.mdRetrieve.validate(context);
  }

  execute(context) {
    return this.mdRetrieve.retrieve(context);
  }
}

export = MetadataRetrieveCommand;

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MdListmetadataApi } from './mdapiListmetadataApi';

/**
 * Command implementation sfdx force:mdapi:listmetadata
 */
class MetadataListmetadataCommand {
  private mdListmetadata;

  constructor(context) {
    this.mdListmetadata = new MdListmetadataApi(context.org);
  }

  validate(context) {
    return this.mdListmetadata.validate(context);
  }

  execute(context) {
    return this.mdListmetadata.retrieve(context);
  }
}

export = MetadataListmetadataCommand;

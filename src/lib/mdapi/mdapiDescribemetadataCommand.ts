/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MdDescribemetadataApi } from './mdapiDescribemetadataApi';

/**
 * Command implementation sfdx force:mdapi:describemetadata
 */
class MetadataDescribemetadataCommand {
  private mdDescribemetadata;

  constructor(context) {
    this.mdDescribemetadata = new MdDescribemetadataApi(context.org);
  }

  validate(context) {
    return this.mdDescribemetadata.validate(context);
  }

  execute(context) {
    return this.mdDescribemetadata.retrieve(context);
  }
}

export = MetadataDescribemetadataCommand;

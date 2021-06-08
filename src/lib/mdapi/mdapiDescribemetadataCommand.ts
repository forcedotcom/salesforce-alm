/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholely superceded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import ScratchOrg = require('./scratchOrgApi');

/**
 * TODO Just extend scratch org for now until everything points over to the
 * new Org class in sfdx-core.
 */
class HubOrgApi extends ScratchOrg {
  constructor(force?) {
    super(force, ScratchOrg.Defaults.DEVHUB);
  }
}

export = HubOrgApi;

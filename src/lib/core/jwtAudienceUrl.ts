/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholely superceded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import * as url from 'url';
import * as _ from 'lodash';

import srcDevUtil = require('./srcDevUtil');

const urls = require('../urls');

export const getJwtAudienceUrl = function(oauthConfig) {
  // default audience must be...
  let audienceUrl = urls.production;
  const loginUrl = _.get(oauthConfig, 'loginUrl', '');
  const createdOrgInstance = _.get(oauthConfig, 'createdOrgInstance', '')
    .trim()
    .toLowerCase();

  if (process.env.SFDX_AUDIENCE_URL) {
    audienceUrl = process.env.SFDX_AUDIENCE_URL;
  } else if (srcDevUtil.isInternalUrl(loginUrl)) {
    // This is for internal developers when just doing authorize;
    audienceUrl = loginUrl;
  } else if (createdOrgInstance.startsWith('cs') || url.parse(loginUrl).hostname === 'test.salesforce.com') {
    audienceUrl = urls.sandbox;
  } else if (createdOrgInstance.startsWith('gs1')) {
    audienceUrl = 'https://gs1.salesforce.com';
  }

  return audienceUrl;
};

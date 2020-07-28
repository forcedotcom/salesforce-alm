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

// Fields the scratch org config object is expected to have
export = {
  ORG_ID: { name: 'orgId' },
  ACCESS_TOKEN: { name: 'accessToken', secret: true },
  REFRESH_TOKEN: { name: 'refreshToken', secret: true, required: false },
  INSTANCE_URL: { name: 'instanceUrl' },
  LOGIN_URL: { name: 'loginUrl', required: false },
  USERNAME: { name: 'username' },
  PASSWORD: { name: 'password', secret: true, required: false },
  CLIENT_ID: { name: 'clientId', required: false },
  PRIVATE_KEY: { name: 'privateKey', required: false },
  CLIENT_SECRET: { name: 'clientSecret', secret: true, required: false },
  CREATED_ORG_INSTANCE: { name: 'createdOrgInstance', required: false },
  CREATED: { name: 'created', required: false },
  DEV_HUB_USERNAME: { name: 'devHubUsername', required: false },
  IS_DEV_HUB: { name: 'isDevHub', required: false },
  IS_SCRATCH_ORG: { name: 'isScratchOrg', required: false },
  SCRATCH_ADMIN_USERNAME: { name: 'scratchAdminUsername', required: false },
  USER_PROFILE_NAME: { name: 'userProfileName', required: false },
  USER_ID: { name: 'userId', required: false },
  TRIAL_EXPIRATION_DATE: { name: 'trialExpirationDate', required: false },
  SNAPSHOT: { name: 'snapshot', required: false },
  EXPIRATION_DATE: { name: 'expirationDate', required: false }
};

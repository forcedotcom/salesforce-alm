/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholly superseded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import { Time } from './time';

class consts {
  static readonly DEFAULT_TIMEOUT: Time = new Time(3);
  static readonly DEFAULT_USER_DIR_MODE: string = '700';
  static readonly DEFAULT_USER_FILE_MODE: string = '600';
  static readonly LISTENER_ABORTED_ERROR_NAME: string = 'streamListenerAborted';
  static readonly DEFAULT_STREAM_TIMEOUT_MINUTES: number = 6;
  static readonly MIN_STREAM_TIMEOUT_MINUTES: number = 2;
  static readonly AUTH_URL_FORMAT1: string = 'force://<refreshToken>@<instanceUrl>';
  static readonly AUTH_URL_FORMAT2: string = 'force://<clientId>:<clientSecret>:<refreshToken>@<instanceUrl>';
  static readonly DEFAULT_SRC_WAIT_MINUTES: number = 33;
  static readonly DEFAULT_MDAPI_WAIT_MINUTES: number = 0;
  static readonly DEFAULT_MDAPI_RETRIEVE_WAIT_MINUTES: number = -1;
  static readonly DEFAULT_MDAPI_POLL_INTERVAL_MINUTES: number = 0.1;
  static readonly DEFAULT_MDAPI_POLL_INTERVAL_MILLISECONDS: number =
    consts.DEFAULT_MDAPI_POLL_INTERVAL_MINUTES * Time.SECONDS_IN_MINUTE * Time.MILLI_IN_SECONDS;
  static readonly MIN_SRC_WAIT_MINUTES: number = 1;
  static readonly MIN_SRC_DEPLOY_WAIT_MINUTES: number = 0;
  static readonly WORKSPACE_CONFIG_FILENAME: string = 'sfdx-project.json';
  static readonly OLD_WORKSPACE_CONFIG_FILENAME: string = 'sfdx-workspace.json';
  static readonly DEFAULT_DEV_HUB_USERNAME: string = 'defaultdevhubusername';
  static readonly DEFAULT_USERNAME: string = 'defaultusername';
  static readonly ACKNOWLEDGED_USAGE_COLLECTION_FILENAME: string = 'acknowledgedUsageCollection.json';

  // tokens to be replaced on source:push
  static readonly INSTANCE_URL_TOKEN: string = '__SFDX_INSTANCE_URL__';
  static readonly DEFAULT_CHUNKSIZE = 500;
}
export = consts;

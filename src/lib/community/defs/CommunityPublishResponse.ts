/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommunityStatus } from './CommunityStatusEnum';
import { URL } from 'url';
/**
 * SFDX command output when publishing a community
 */
export type CommunityPublishResponse = {
  /**
   * community ID
   */
  id: string;

  /**
   * output message
   */
  message: string;

  /**
   * name of the community
   */
  name: string;

  /**
   * community status (Active/Inactive/DownForMaintainance)
   */
  status?: CommunityStatus;

  /**
   * url to access the community
   */
  url: URL;
};

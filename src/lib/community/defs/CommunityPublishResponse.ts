/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

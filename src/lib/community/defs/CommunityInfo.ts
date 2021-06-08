/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommunityStatus } from './CommunityStatusEnum';
/**
 * A definition of a community
 */
export type CommunityInfo = {
  /**
   * Community name
   */
  name: string;

  /**
   * Community ID
   */
  id: string;

  /**
   * Community Status (Active/Inactive/DownForMaintainance)
   */
  status?: CommunityStatus;
};

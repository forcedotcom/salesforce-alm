/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

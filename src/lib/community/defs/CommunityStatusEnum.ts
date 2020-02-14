/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Community status
 */
export type CommunityStatus = {
  /**
   * Community is still in development
   */
  UnderConstruction: 'UnderConstruction';

  /**
   * Community is live
   */
  Live: 'Live';

  /**
   * Community is inactive
   */
  DownForMaintenance: 'DownForMaintenance';
};

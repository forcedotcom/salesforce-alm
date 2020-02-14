/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * SFDX command output when creating a community
 */
export type CommunityCreateResponse = {
  /**
   * output message
   */
  message: string;

  /**
   * name of the community
   */
  name: string;

  /**
   * the next actions that user can do to check, if community is created or not.
   */
  action: string;
};

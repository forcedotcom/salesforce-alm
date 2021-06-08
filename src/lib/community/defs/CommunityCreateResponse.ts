/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

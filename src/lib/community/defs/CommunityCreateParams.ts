/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * SFDX command parameters when creating a community
 */
export type CommunityCreateParams = {
  /**
   * name of the community to create
   */
  name: string;

  /**
   * template name to be used to create a community
   */
  templateName: string;

  /**
   * url path prefix of the community.
   */
  urlPathPrefix: string;

  /**
   * the description for the community
   */
  description;
};

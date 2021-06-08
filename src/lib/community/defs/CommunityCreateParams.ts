/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';

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

  /**
   * template parameters for the template used to create the community
   */
  templateParams?: JsonMap;
};

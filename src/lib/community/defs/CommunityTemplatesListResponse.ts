/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * SFDX command output when listing available community templates
 */
import { CommunityTemplates } from '../defs/CommunityTemplates';
export type CommunityTemplatesListResponse = {
  /**
   * list of templates
   */
  templates: CommunityTemplates[];
  total: number;
};

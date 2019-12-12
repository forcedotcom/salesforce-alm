/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';

/**
 * An action script that is used to upgrade a project.
 */
export default class UpgradeAction {
  constructor(readonly description: string, readonly action: (projectDir: string) => Promise<string>) {
    if (!description || !_.isString(description)) {
      throw new Error('DEV ERROR: Description required');
    }
  }

  act(projectDir: string): Promise<string> {
    return this.action(projectDir);
  }
}

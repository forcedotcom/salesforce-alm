/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as _ from 'lodash';
import * as BBPromise from 'bluebird';

const fs = BBPromise.promisifyAll(require('fs'));

import consts = require('../../core/constants');
import Messages = require('../../messages');
const messages = Messages();

import UpgradeAction from './UpgradeAction';

export const HEADS_UP = /"([A-Z])(\w*"\s*:)/g;
export const REPLACE_FN = (whole, m1, m2) => `"${m1.toLowerCase()}${m2}`;

export default async function(
  projectDir: string,
  prompt: (msg: string) => BBPromise<string>
): BBPromise<UpgradeAction> {
  const projectFile = path.join(projectDir, consts.WORKSPACE_CONFIG_FILENAME);

  const fileContents = await fs.readFileAsync(projectFile, 'utf8');

  if (fileContents.match(HEADS_UP)) {
    return new UpgradeAction(
      messages.getMessage('action_headsDownProject', [consts.WORKSPACE_CONFIG_FILENAME], 'projectUpgrade'),
      () => {
        return fs.writeFileAsync(projectFile, fileContents.replace(HEADS_UP, REPLACE_FN));
      }
    );
  }
  return BBPromise.resolve(null);
}

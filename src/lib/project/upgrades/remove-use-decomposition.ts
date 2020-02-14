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
import utils = require('../../core/srcDevUtil');

import UpgradeAction from './UpgradeAction';

export default async function(
  projectDir: string,
  prompt: (msg: string) => BBPromise<string>
): BBPromise<UpgradeAction> {
  const projectFile = path.join(projectDir, consts.WORKSPACE_CONFIG_FILENAME);

  if ((await fs.readFileAsync(projectFile, 'utf8')).match(/"useDecomposition"/i)) {
    return new UpgradeAction(
      messages.getMessage('action_removeUseDecomposition', [consts.WORKSPACE_CONFIG_FILENAME], 'projectUpgrade'),
      async () => {
        const json = await utils.readJSON(projectFile);
        delete json.useDecomposition;
        return fs.writeFileAsync(projectFile, JSON.stringify(json, undefined, 2));
      }
    );
  }
  return BBPromise.resolve(null);
}

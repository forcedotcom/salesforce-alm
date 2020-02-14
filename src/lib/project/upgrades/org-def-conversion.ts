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

import utils = require('../../core/srcDevUtil');
import Messages = require('../../messages');
const messages = Messages();

import UpgradeAction from './UpgradeAction';

import { HEADS_UP } from './heads-down-project';
import { REPLACE_FN } from './heads-down-project';

const DEFAULT = path.join('config', '*def.json');

export default async function(
  projectDir: string,
  prompt: (msg: string) => BBPromise<string>
): BBPromise<UpgradeAction> {
  let answer = await prompt(messages.getMessage('prompt_orgDefPattern', [DEFAULT], 'projectUpgrade'));

  if (answer === 'SKIP') {
    // No action
    return BBPromise.resolve(null);
  }

  if (answer === 'D' || answer === 'DEFAULT') {
    answer = DEFAULT;
  }

  answer = answer.replace(/[.?+^$[\]\\(){}|-]/g, '\\$&');
  answer = answer.replace('*', '.*');

  const fileRegex = new RegExp(`${answer}$`);

  // Find file names that match the regex
  const matchedFiles = [];

  utils.actOn(projectDir, file => {
    if (file.match(fileRegex)) {
      matchedFiles.push(file);
    }
  });

  // Check matched files for heads up
  const files = [];
  for (let matchedFile of matchedFiles) {
    // Don't store this so we don't put a bunch of files in memory. The write is going to happen at a later time.
    const contents = await fs.readFileAsync(matchedFile, 'utf8');
    // Check headsUp, company, country, and orgPreference format.
    const needsAction =
      contents.match(HEADS_UP) ||
      contents.match(/"[cC]ompany"\s*:/) ||
      contents.match(/"[eE]mail"\s*:/) ||
      contents.match(/"[oO]rgPreferences"\s*:\s*\{\s*"(?!(enabled|disabled))/) ||
      contents.match(/"[lL]astName"\s*:/);

    if (needsAction) {
      files.push(matchedFile);
    }
  }

  if (files.length > 0) {
    return BBPromise.resolve(
      new UpgradeAction(messages.getMessage('action_orgDefConversion', [files.length], 'projectUpgrade'), async () => {
        // Not doing this in parrellel right now, but we could
        for (let file of files) {
          let json = await utils.readJSON(file);

          // Org preferences need to stay in upper, so  move to array form first
          const orgPreferences = json.orgPreferences || json.OrgPreferences;
          if (_.isPlainObject(orgPreferences) && !orgPreferences.enabled && !orgPreferences.disabled) {
            const enabled = _.map(orgPreferences, (enabled, prefName) => (!!enabled ? prefName : null)).filter(
              _.isString
            );
            const disabled = _.map(orgPreferences, (enabled, prefName) => (!enabled ? prefName : null)).filter(
              _.isString
            );
            delete json.OrgPreferences;
            json.orgPreferences = { enabled, disabled };
          }

          const contents = JSON.stringify(json).replace(HEADS_UP, REPLACE_FN);
          json = await utils.parseJSON(contents, file);

          if (json.company) {
            json.orgName = json.company;
            delete json.company;
          }

          if (json.email) {
            json.adminEmail = json.email;
            delete json.email;
          }

          if (json.lastName) {
            delete json.lastName;
          }

          await fs.writeFileAsync(file, JSON.stringify(json, null, 2));
        }
        return BBPromise.resolve(null);
      })
    );
  }
  return BBPromise.resolve(null);
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholely superceded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import * as path from 'path';

import * as _ from 'lodash';
import * as BBPromise from 'bluebird';

const fs = BBPromise.promisifyAll(require('fs'));

import UpgradeAction from './upgrades/UpgradeAction';

import Messages = require('../messages');
const messages = Messages();
import * as error from '../core/almError';
import utils = require('../core/srcDevUtil');
import consts = require('../core/constants');
import logger = require('../core/logApi');
import * as projectDirUtil from '../core/projectDir';

// List all project update actions but not sure how to do dynamic imports with typescript
// since it needs the static checker. If this list grows to long, future us can worry about it.
//
// IMPORTANT NOTE: Order matters here. When adding a new project upgrade script, make sure you
// put it at the END of the array.
import headsDownProject from './upgrades/heads-down-project';
import orgDefConversion from './upgrades/org-def-conversion';
import removeUseDecomposition from './upgrades/remove-use-decomposition';

const actionsFns: Array<(
  projectDir: string,
  prompt: (msg: string) => BBPromise<string>
) => BBPromise<UpgradeAction>> = [headsDownProject, orgDefConversion, removeUseDecomposition];

/**
 * Special update action that fixes the break in what a "project" is. i.e. sfdx-workspace.json -> sfdx-project.json.
 * @param prompt
 */
async function upgradeAndGetProjectPath(prompt: (msg: string) => BBPromise<string>): BBPromise<string> {
  let projectPath;
  try {
    projectPath = projectDirUtil.getPath();
  } catch (err) {
    if (err.name === 'InvalidProjectWorkspace' && err.oldAndBustedPath) {
      const answer = (
        await prompt(
          messages.getMessage(
            'prompt_renameProjectFile',
            [`${err.oldAndBustedPath}/${consts.OLD_WORKSPACE_CONFIG_FILENAME}`, consts.WORKSPACE_CONFIG_FILENAME],
            'projectUpgrade'
          )
        )
      ).toLowerCase();

      if (answer === 'yes' || answer === 'y') {
        const oldFile = path.join(err.oldAndBustedPath, consts.OLD_WORKSPACE_CONFIG_FILENAME);
        const newFile = path.join(err.oldAndBustedPath, consts.WORKSPACE_CONFIG_FILENAME);
        return fs.renameAsync(oldFile, newFile).then(() => err.oldAndBustedPath);
      } else {
        return BBPromise.resolve(null);
      }
    }
    return BBPromise.resolve(null);
  }
  return BBPromise.resolve(projectPath);
}

const UPGRADE_STATE_FILE = 'upgrade-state.txt';

async function readCurrentUpgradeVersion(projectPath: string): BBPromise<number> {
  const upgradeStateFile: string = path.join(projectPath, utils.getWorkspaceStateFolderName(), UPGRADE_STATE_FILE);

  return fs
    .readFileAsync(upgradeStateFile, 'utf8')
    .then(data => parseInt(data))
    .catch(() => 0);
}

async function saveCurrentUpgradeVersion(projectPath: string, upgradeNumber: number) {
  const upgradeStateFile: string = path.join(projectPath, utils.getWorkspaceStateFolderName(), UPGRADE_STATE_FILE);

  return fs.writeFileAsync(upgradeStateFile, upgradeNumber).catch(() => {});
}

/**
 * Preform the upgrade using all upgrade actions that haven't been applied that need to be.
 * @param prompt
 */
async function upgrades(prompt: (msg: string) => BBPromise<string>, force: boolean = false): BBPromise<Object> {
  let projectPath: string = await upgradeAndGetProjectPath(prompt);

  if (_.isNil(projectPath)) {
    throw error({
      keyName: 'error_validProject',
      bundle: 'projectUpgrade'
    });
  }

  let upgradeNumber: number = 0;

  if (!force) {
    upgradeNumber = await readCurrentUpgradeVersion(projectPath);
  }

  let actions: Array<UpgradeAction> = [];

  for (let actionFn; upgradeNumber < actionsFns.length; upgradeNumber++) {
    actionFn = actionsFns[upgradeNumber];
    actions.push(await actionFn(projectPath, prompt));
  }

  actions = _.compact(actions);

  if (actions.length > 0) {
    logger.log();

    let answer = (
      await prompt(messages.getMessage('prompt_queuedActions', [actions.length], 'projectUpgrade'))
    ).toLowerCase();

    if (answer === 'list') {
      logger.log(_.map(actions, action => `\t - ${action.description}`).join('\n'));
      logger.log();
      answer = (await prompt(messages.getMessage('prompt_continue', [], 'projectUpgrade'))).toLowerCase();
    }

    if (answer === 'yes' || answer === 'y') {
      for (let action of actions) {
        const result = await action.act(projectPath);

        if (!_.isNil(result)) {
          throw error('error_upgradeFailed', [result]);
        }
      }
    } else {
      logger.log(messages.getMessage('skipping', [actions.length], 'projectUpgrade'));
      return BBPromise.resolve({});
    }
  } else {
    logger.log();
    logger.log(messages.getMessage('uptodate', [], 'projectUpgrade'));
  }

  return saveCurrentUpgradeVersion(projectPath, upgradeNumber)
    .then(() => {
      logger.log('\nProject successfully upgraded.\n');
    })
    .then(() => ({ actions: _.map(actions, 'description') }));
}

export = upgrades;

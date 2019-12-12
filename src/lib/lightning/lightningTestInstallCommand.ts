/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import Messages = require('../messages');
import * as request from 'request';

import PackageInstallCommand = require('../package/packageInstallCommand');
import logApi = require('../core/logApi');

export = class LightningTestInstallCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logApi.child('lightningTestInstallCommand');
    this.request = request;
    this.packageInstallCommand = new PackageInstallCommand();
    this.messages = Messages();
  }

  validate(context) {
    this.org = context.org;
    const options = context.flags;
    return Promise.resolve(options);
  }

  execute(context) {
    const org = this.org;
    const releaseVersion =
      context.releaseversion && context.releaseversion !== 'latest' ? `tags/${context.releaseversion}` : 'latest';
    const uri = `https://api.github.com/repos/forcedotcom/LightningTestingService/releases/${releaseVersion}`;

    return new Promise((resolve, reject) => {
      this.request(
        {
          headers: {
            'User-Agent': 'LTS'
          },
          uri
        },
        (err, res, body) => {
          if (err) {
            return reject(new Error(err));
          }

          if (res.statusCode !== 200) {
            this.logger.debug(`Unable to reach ${uri}. statusCode=${res.statusCode}, response body=${body}`);
            return reject(new Error(this.messages.getMessage('packageIdRetrievalIssue', [uri], 'lightning_test')));
          }

          const content = JSON.parse(body);
          if (content.message === 'Not Found') {
            return reject(
              new Error(this.messages.getMessage('invalidVersion', [context.releaseversion], 'lightning_test'))
            );
          }

          const packagetype = context.packagetype ? context.packagetype.toLowerCase() : 'full';
          let name;
          if (packagetype === 'jasmine') {
            name = 'jasmine';
          } else if (packagetype === 'mocha') {
            name = 'mocha';
          } else if (packagetype === 'full') {
            name = 'examples';
          } else {
            return reject(new Error(this.messages.getMessage('invalidType', [packagetype], 'lightning_test')));
          }

          const regEx = new RegExp(`\\[.*${name}.*\\]\\(.*p0=(\\w{15}).*\\)`, 'i');
          const releaseMsg = content.body;
          const regExMatch = regEx.exec(releaseMsg);
          let id;
          if (regExMatch && regExMatch.length === 2) {
            id = regExMatch[1];
          } else {
            this.logger.debug(
              `Unable to map test framework to package id using the release description, ${releaseMsg}`
            );
            return reject(new Error(this.messages.getMessage('packageIdExtractionIssue', [uri], 'lightning_test')));
          }

          const ctx = {
            org,
            flags: {
              id,
              wait: context.wait ? context.wait : 2,
              securitytype: 'AllUsers'
            }
          };

          return resolve(this.packageInstallCommand.execute(ctx));
        }
      );
    });
  }

  /**
   * returns a human readable message for a cli output
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    return this.packageInstallCommand.getHumanSuccessMessage(result);
  }
};

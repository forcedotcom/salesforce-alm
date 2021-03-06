/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import logger = require('../core/logApi');
import Messages = require('../messages');
const messages = Messages();
import pkgUtils = require('./packageUtils');

class PackageDeleteCommand {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  constructor(stdinPrompt?) {
    this.stdinPrompt = stdinPrompt;
    this.logger = logger.child('PackageDeleteCommand');
    this.isUndelete = false;
  }

  execute(context) {
    return this._execute(context).catch((err) => {
      // TODO:
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      err = pkgUtils.massageErrorMessage(err);
      throw pkgUtils.applyErrorAction(err);
    });
  }

  async _execute(context) {
    this.org = context.org;
    this.force = context.org.force;

    const packageId = pkgUtils.getPackageIdFromAlias(context.flags.package, this.force);
    pkgUtils.validateId(pkgUtils.BY_LABEL.PACKAGE_ID, packageId);

    const request: any = {};
    request.Id = packageId;
    this.isUndelete = context.flags.undelete;
    request.IsDeprecated = !this.isUndelete;

    // user must acknowledge the warning prompt or use noprompt flag
    const accepted = await this._prompt(
      context.flags.noprompt,
      messages.getMessage(this.isUndelete ? 'promptUndelete' : 'promptDelete', [], 'package_delete')
    );
    if (!accepted) {
      throw new Error(messages.getMessage('promptDeleteDeny', [], 'package_delete'));
    }

    return this.force.toolingUpdate(this.org, 'Package2', request).then((updateResult) => {
      if (!updateResult.success) {
        throw new Error(updateResult.errors);
      }
      return updateResult;
    });
  }

  async _prompt(noninteractive, message) {
    const answer = noninteractive ? 'YES' : await this.stdinPrompt(message);
    // print a line of white space after the prompt is entered for separation
    this.logger.log('');
    return answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y';
  }

  getHumanSuccessMessage(result) {
    return messages.getMessage(
      this.isUndelete ? 'humanSuccessUndelete' : 'humanSuccess',
      [result.id],
      'package_delete'
    );
  }
}

export = PackageDeleteCommand;

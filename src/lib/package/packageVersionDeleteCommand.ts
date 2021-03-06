/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import Messages = require('../messages');
const messages = Messages();
import logger = require('../core/logApi');
import pkgUtils = require('./packageUtils');

class PackageVersionDeleteCommand {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  constructor(stdinPrompt?) {
    this.stdinPrompt = stdinPrompt;
    this.logger = logger.child('PackageVersionsDeleteCommand');
    this.isUndelete = false;
  }

  execute(context) {
    return this._execute(context).catch((err) => {
      // TODO
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      err = pkgUtils.massageErrorMessage(err);
      throw pkgUtils.applyErrorAction(err);
    });
  }

  async _execute(context) {
    this.org = context.org;
    this.force = context.org.force;

    const packageVersionId = pkgUtils.getPackageIdFromAlias(context.flags.package, this.force);

    // ID can be an 04t or 05i
    pkgUtils.validateId(
      [pkgUtils.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, pkgUtils.BY_LABEL.PACKAGE_VERSION_ID],
      packageVersionId
    );

    // lookup the 05i ID, if needed
    context.flags.package = await pkgUtils.getPackageVersionId(packageVersionId, this.force, this.org);

    // setup the request
    const request = {};
    request['Id'] = context.flags.package;

    // delete or undelete
    this.isUndelete = context.flags.undelete;
    request['IsDeprecated'] = !this.isUndelete;

    // user must acknowledge the warning prompt or use noprompt flag
    const accepted = await this._prompt(
      context.flags.noprompt,
      messages.getMessage(this.isUndelete ? 'promptUndelete' : 'promptDelete', [], 'package_version_delete')
    );
    if (!accepted) {
      throw new Error(messages.getMessage('promptDeleteDeny', [], 'package_version_delete'));
    }

    return this.force.toolingUpdate(this.org, 'Package2Version', request).then(async (updateResult) => {
      if (!updateResult.success) {
        throw new Error(updateResult.errors);
      }
      // Use the 04t ID for the success messgae
      updateResult.id = await pkgUtils.getSubscriberPackageVersionId(packageVersionId, this.force, this.org);
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
      'package_version_delete'
    );
  }
}
export = PackageVersionDeleteCommand;

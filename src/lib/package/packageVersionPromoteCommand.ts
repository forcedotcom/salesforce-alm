/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import ux from 'cli-ux';
import pkgUtils = require('../package/packageUtils');

import Messages = require('../messages');
const messages = Messages();

class PackageVersionPromoteCommand {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  constructor() {
    this.error = null;
  }

  execute(context) {
    return this._execute(context).catch((err) => {
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      err = pkgUtils.massageErrorMessage(err);
      throw pkgUtils.applyErrorAction(err);
    });
  }

  async _execute(context) {
    this.org = context.org;
    this.force = context.org.force;

    let packageId = pkgUtils.getPackageIdFromAlias(context.flags.package, this.force);

    // if no alias found, set the package id as the cli arg.
    if (!packageId) {
      packageId = context.flags.package;
    }
    // ID can be 04t or 05i
    pkgUtils.validateId(
      [pkgUtils.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, pkgUtils.BY_LABEL.PACKAGE_VERSION_ID],
      packageId
    );

    // lookup the 05i ID, if needed
    packageId = await pkgUtils.getPackageVersionId(packageId, this.force, this.org);

    if (!context.flags.noprompt) {
      // Warn when a Managed package has removed metadata
      if ((await pkgUtils.getHasMetadataRemoved(packageId, this.force, this.org)) === true) {
        ux.warn(messages.getMessage('hasMetadataRemovedWarning', [], 'package_version_create'));
      }

      // Prompt for confirmation
      let confirmed = false;
      const heroku = require('heroku-cli-util');
      await heroku
        .prompt(
          messages.getMessage(
            'packageVersionPromoteSetAsReleasedYesNo',
            context.flags.package,
            'package_version_promote'
          ),
          {}
        )
        .then((answer) => {
          if (answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y') {
            confirmed = true;
          }
        });
      if (!confirmed) {
        return;
      }
    }

    const request: any = {};
    request.IsReleased = true;
    request.Id = packageId;

    return this.force
      .toolingUpdate(this.org, 'Package2Version', request)
      .then(async (updateResult) => {
        if (!updateResult.success) {
          throw new Error(updateResult.errors);
        }
        // return the 04t in the success msg
        updateResult.id = await pkgUtils.getSubscriberPackageVersionId(packageId, this.force, this.org);
        return updateResult;
      })
      .catch((err) => {
        if (err.name === 'DUPLICATE_VALUE' && err.message.includes('previously released')) {
          err['message'] = messages.getMessage('previouslyReleasedMessage', [], 'package_version_promote');
          err['action'] = messages.getMessage('previouslyReleasedAction', [], 'package_version_promote');
        }
        throw err;
      });
  }

  getHumanSuccessMessage(result) {
    // skip success message when prompt was not accepted
    return result ? messages.getMessage('humanSuccess', [result.id], 'package_version_promote') : null;
  }
}
export = PackageVersionPromoteCommand;

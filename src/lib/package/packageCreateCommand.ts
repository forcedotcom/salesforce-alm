/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import * as path from 'path';
import logger = require('../core/logApi');
import Messages = require('../messages');
const messages = Messages();
import srcDevUtil = require('../core/srcDevUtil');
import pkgUtils = require('./packageUtils');

class PackageCreateCommand {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  constructor() {
    this.logger = logger.child('package:create');
  }

  orgDependent = false;

  /**
   * Convert the list of command line options to a JSON object that can be used to create a Package2 entity.
   *
   * @param context
   * @returns {{Name: (string|string|*), Description: (boolean|string|string|*), NamespacePrefix: (string|s)}}
   * @private
   */
  _createPackage2RequestFromContext(context) {
    const namespace = context.flags.nonamespace ? '' : context.org.force.config.getConfigContent().namespace;
    this.orgDependent = context.flags.orgdependent;
    return {
      Name: context.flags.name,
      Description: context.flags.description,
      NamespacePrefix: namespace,
      ContainerOptions: context.flags.packagetype,
      IsOrgDependent: context.flags.orgdependent,
      PackageErrorUsername: context.flags.errornotificationusername,
    };
  }

  execute(context) {
    return this._execute(context).catch((err) => {
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      err = pkgUtils.massageErrorMessage(err);
      throw pkgUtils.applyErrorAction(err);
    });
  }

  _execute(context) {
    this.org = context.org;
    this.force = context.org.force;

    // strip trailing slash from path param
    if (context.flags.path.endsWith(path.sep) && context.flags.path.length > 1) {
      context.flags.path = context.flags.path.slice(0, -1);
    }

    const request = this._createPackage2RequestFromContext(context);
    let packageId = null;

    return this.force
      .toolingCreate(this.org, 'Package2', request)
      .then((createResult) => {
        if (!createResult.success) {
          throw new Error(createResult.errors);
        }
        packageId = createResult.id;
        return this.force.toolingQuery(this.org, `SELECT Id FROM Package2 WHERE Id='${packageId}'`);
      })
      .then(async (queryResult) => {
        if (!queryResult.records || !queryResult.records[0]) {
          throw Error(`Unable to find Package with Id: ${packageId}`);
        }

        const record = queryResult.records[0];

        if (!process.env.SFDX_PROJECT_AUTOUPDATE_DISABLE_FOR_PACKAGE_CREATE) {
          const packageDirectory = this._generatePackageDirEntry(context);
          const packageAliases = this._generatePackageAliasEntry(context, record.Id);
          const newConfig = Object.assign(packageDirectory, packageAliases);

          // create path dir if needed
          srcDevUtil.ensureDirectoryExistsSync(path.join(process.cwd(), context.flags.path));

          await pkgUtils._writeProjectConfigToDisk(context, newConfig, logger);
        }

        return { Id: record.Id };
      });
  }

  /**
   * Generate packageDirectory json entry for this package that can be written to sfdx-project.json
   *
   * @param context
   * @param packageId the 0Ho id of the package to create the entry for
   * @private
   */
  _generatePackageDirEntry(context) {
    let packageDirs = pkgUtils.getConfigPackageDirectories(context);
    if (!packageDirs) {
      packageDirs = [];
    }

    // add an entry if it doesn't exist
    // or update an existing entry if it matches path but has no package or id attribute (W-5092620)
    let packageDir = pkgUtils.getConfigPackageDirectory(packageDirs, 'package', context.flags.name);
    if (!packageDir) {
      // no match for package, check for a matching path without id and package attribs
      const index = packageDirs.findIndex((pd) => pd.path === context.flags.path && !pd.id && !pd.package);
      if (index > -1) {
        // update existing entry
        packageDirs[index].package = context.flags.name;
        if (!Object.prototype.hasOwnProperty.call(packageDirs[index], 'versionName')) {
          packageDirs[index].versionName = pkgUtils.DEFAULT_PACKAGE_DIR.versionName;
        }
        if (!Object.prototype.hasOwnProperty.call(packageDirs[index], 'versionNumber')) {
          packageDirs[index].versionNumber = pkgUtils.DEFAULT_PACKAGE_DIR.versionNumber;
        }
        if (!Object.prototype.hasOwnProperty.call(packageDirs[index], 'default')) {
          packageDirs[index].default = !pkgUtils.getConfigPackageDirectory(packageDirs, 'default', true);
        }
      } else {
        // add new entry
        packageDir = pkgUtils.DEFAULT_PACKAGE_DIR;
        packageDir.package = context.flags.name;
        // set as default if this is the only entry or no other entry is the default
        packageDir.default =
          packageDirs.length === 0 || !pkgUtils.getConfigPackageDirectory(packageDirs, 'default', true);
        packageDir.path = context.flags.path;

        packageDirs.push(packageDir);
      }
    }

    return { packageDirectories: packageDirs };
  }

  /**
   * Generate package alias json entry for this package that can be written to sfdx-project.json
   *
   * @param context
   * @param packageId the 0Ho id of the package to create the alias entry for
   * @private
   */
  _generatePackageAliasEntry(context, packageId) {
    const configContent = this.force.config.getConfigContent();
    const packageAliases = configContent.packageAliases ? configContent.packageAliases : {};

    const packageName = context.flags.name;
    packageAliases[packageName] = packageId;

    return { packageAliases };
  }

  /**
   * returns a human readable message for a cli output
   *
   * @param result - the data representing the Package Version
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    const data = [{ name: 'Package Id', value: result.Id }];
    this.logger.log(
      messages.getMessage(
        'humanSuccess',
        data.map((d) => d.value),
        'package_create'
      )
    );
    this.logger.styledHeader(this.logger.color.blue('Ids'));
    this.logger.table(data, {
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'value', label: 'Value' },
      ],
    });
    if (this.orgDependent) {
      this.logger.log('This package depends on unpackaged metadata in the installation org, and is a beta feature.');
      this.logger.log('Use Source Tracking in Sandboxes (Beta), to develop your org-dependent unlocked package.');
    }

    return '';
  }
}

export = PackageCreateCommand;

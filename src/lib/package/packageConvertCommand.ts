/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as path from 'path';
import * as util from 'util';
import * as os from 'os';
import * as crypto from 'crypto';
import * as BBPromise from 'bluebird';

// Local

import logApi = require('../core/logApi');
import srcDevUtil = require('../core/srcDevUtil');
import PackageVersionCreateRequestApi = require('./packageVersionCreateRequestApi');
import pkgUtils = require('./packageUtils');
// import SettingsGenerator = require('../org/scratchOrgSettingsGenerator');
import PackageVersionCreateCommand = require('./packageVersionCreateCommand');
const fs = BBPromise.promisifyAll(require('fs-extra'));

interface Package2VersionCreateRequestObject {
  Package2Id: string;
  VersionInfo: string;
  InstallKey: string;
  Instance: string;
  IsConversionRequest: boolean;
}

class PackageConvertCommand {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  private DESCRIPTOR_FILE = 'package2-descriptor.json';
  private logger: any;
  private maxRetries: number;
  private packageVersionCreateCommand: PackageVersionCreateCommand;

  constructor() {
    this.maxRetries = 0;
    this.logger = logApi.child('package:convert');
    this.packageVersionCreateCommand = new PackageVersionCreateCommand();
  }

  execute(context) {
    return this.innerExecute(context).catch((err) => {
      err = pkgUtils.massageErrorMessage(err);
      throw pkgUtils.applyErrorAction(err);
    });
  }

  private async innerExecute(context) {
    this.org = context.org;
    this.force = this.org.force;
    this.packageVersionCreateRequestApi = new PackageVersionCreateRequestApi(this.force, this.org);

    if (context.flags.wait) {
      this.maxRetries = (60 / pkgUtils.POLL_INTERVAL_SECONDS) * context.flags.wait;
    }

    // This command also requires either the installationkey flag or installationkeybypass flag
    if (!context.flags.installationkey && !context.flags.installationkeybypass) {
      return this.packageVersionCreateCommand.rejectWithInstallKeyError(context);
    }

    const seedPackage: string = context.flags.package;
    const packageId = await pkgUtils.findOrCreatePackage2(seedPackage, this.force, this.org);

    const request = await this.createPackageVersionCreateRequest(context, packageId);

    const createResult = await this.force.toolingCreate(this.org, 'Package2VersionCreateRequest', request);
    if (!createResult.success) {
      const errStr =
        createResult.errors && createResult.errors.length ? createResult.errors.join(', ') : createResult.errors;
      throw new Error(`Failed to create request${createResult.id ? ` [${createResult.id}]` : ''}: ${errStr}`);
    }

    let results;
    if (context.flags.wait) {
      results = await pkgUtils.pollForStatus(
        context,
        createResult.id,
        this.maxRetries,
        packageId,
        this.logger,
        false,
        this.force,
        this.org
      );
    } else {
      results = await this.packageVersionCreateRequestApi.byId(packageId);
    }

    return util.isArray(results) ? results[0] : results;
  }

  /**
   * Convert the list of command line options to a JSON object that can be used to create an Package2VersionCreateRequest entity.
   *
   * @param context: command context
   * @param packageId: package2 id to create a package version for
   * @returns {{Package2Id: string, Package2VersionMetadata: *, Tag: *, Branch: number}}
   * @private
   */
  private async createPackageVersionCreateRequest(context, packageId: string) {
    const uniqueHash: string = crypto.createHash('sha1').update(`${Date.now()}${Math.random()}`).digest('hex');
    const packageVersTmpRoot: string = path.join(os.tmpdir(), `${packageId}-${uniqueHash}`);
    const packageVersBlobDirectory: string = path.join(packageVersTmpRoot, 'package-version-info');
    const packageVersBlobZipFile: string = path.join(packageVersTmpRoot, 'package-version-info.zip');

    const packageDescriptorJson = {
      id: packageId,
    };

    srcDevUtil.ensureDirectoryExistsSync(packageVersTmpRoot);
    srcDevUtil.ensureDirectoryExistsSync(packageVersBlobDirectory);

    fs.writeJSONAsync(path.join(packageVersBlobDirectory, this.DESCRIPTOR_FILE), packageDescriptorJson);

    // Zip the Version Info and package.zip files into another zip
    await srcDevUtil.zipDir(packageVersBlobDirectory, packageVersBlobZipFile);

    return this.createRequestObject(packageId, context, packageVersTmpRoot, packageVersBlobZipFile);
  }

  private createRequestObject(
    packageId,
    context,
    packageVersTmpRoot,
    packageVersBlobZipFile
  ): Package2VersionCreateRequestObject {
    const zipFileBase64 = fs.readFileSync(packageVersBlobZipFile).toString('base64');
    const requestObject: Package2VersionCreateRequestObject = {
      Package2Id: packageId,
      VersionInfo: zipFileBase64,
      InstallKey: context.flags.installationkey,
      Instance: context.flags.buildinstance,
      IsConversionRequest: true,
    };

    return fs.removeAsync(packageVersTmpRoot).then(() => requestObject);
  }

  /**
   *
   * @param result - the data representing the Package Version, must include a 'Status' property
   * @returns {string} a human readable message for CLI output
   */
  getHumanSuccessMessage(result) {
    return this.packageVersionCreateCommand.getHumanSuccessMessage(result);
  }
}

export = PackageConvertCommand;

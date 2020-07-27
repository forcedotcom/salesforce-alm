/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as path from 'path';
import * as BBPromise from 'bluebird';
const fs = BBPromise.promisifyAll(require('fs-extra'));
import * as util from 'util';
import * as os from 'os';
import * as crypto from 'crypto';
import * as _ from 'lodash';

// Third party
const xml2js = BBPromise.promisifyAll(require('xml2js'));

// Local
// New messages (move to this)
import { SfdxError, Messages } from '@salesforce/core';
Messages.importMessagesDirectory(__dirname);

// Old style messages
import MessagesLocal = require('../messages');
const messages = MessagesLocal();

import * as almError from '../core/almError';

import logApi = require('../core/logApi');
import srcDevUtil = require('../core/srcDevUtil');
import PackageVersionCreateRequestApi = require('./packageVersionCreateRequestApi');
import SourceConvertCommand = require('../source/sourceConvertCommand');
import pkgUtils = require('./packageUtils');
import ProfileApi = require('../package/profileApi');
import SettingsGenerator = require('../org/scratchOrgSettingsGenerator');

import consts = require('../core/constants');

const DESCRIPTOR_FILE = 'package2-descriptor.json';

let logger;

const POLL_INTERVAL_WITHOUT_VALIDATION_SECONDS = 5;

class PackageVersionCreateCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.pollInterval = pkgUtils.POLL_INTERVAL_SECONDS;
    this.maxRetries = 0;
    logger = logApi.child('package:version:create');
  }

  // convert source to mdapi format and copy to tmp dir packaging up
  _generateMDFolderForArtifact(options) {
    const convertCmd = new SourceConvertCommand();
    const context = {
      flags: {
        rootdir: options.sourcedir,
        outputdir: options.deploydir
      }
    };
    return BBPromise.resolve()
      .then(() => convertCmd.validate(context))
      .then(fixedcontext => convertCmd.execute(fixedcontext));
  }

  _validateDependencyValues(dependency) {
    // If valid 04t package, just return it to be used straight away.
    if (dependency.subscriberPackageVersionId) {
      pkgUtils.validateId(pkgUtils.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, dependency.subscriberPackageVersionId);

      return BBPromise.resolve();
    }

    if (dependency.packageId && dependency.package) {
      throw new Error(messages.getMessage('errorPackageAndPackageIdCollision', [], 'package_version_create'));
    }

    const packageIdFromAlias = pkgUtils.getPackageIdFromAlias(dependency.packageId || dependency.package, this.force);

    // If valid 04t package, just return it to be used straight away.
    if (pkgUtils.validateIdNoThrow(pkgUtils.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, packageIdFromAlias)) {
      dependency.subscriberPackageVersionId = packageIdFromAlias;

      return BBPromise.resolve();
    }

    if (!packageIdFromAlias || !dependency.versionNumber) {
      throw new Error(
        messages.getMessage('errorDependencyPair', [JSON.stringify(dependency)], 'package_version_create')
      );
    }

    // Just override dependency.packageId value to the resolved alias.
    dependency.packageId = packageIdFromAlias;

    pkgUtils.validateId(pkgUtils.BY_LABEL.PACKAGE_ID, dependency.packageId);
    pkgUtils.validateVersionNumber(dependency.versionNumber, pkgUtils.LATEST_BUILD_NUMBER_TOKEN);

    // Validate that the Package2 id exists on the server
    const query = `SELECT Id FROM Package2 WHERE Id = '${dependency.packageId}'`;
    return this.force.toolingQuery(this.org, query).then(pkgQueryResult => {
      const subRecords = pkgQueryResult.records;
      if (!subRecords || subRecords.length !== 1) {
        throw new Error(messages.getMessage('errorNoIdInHub', [dependency.packageId], 'package_version_create'));
      }
    });
  }

  /**
   *  A dependency in the workspace config file may be specified using either a subscriber package version id (04t)
   *  or a package Id (0Ho) + a version number.  Additionally, a build number may be the actual build number, or the
   *  LATEST keyword (meaning the latest build number for a given major.minor.patch).  This method resolves a
   *  package Id + version number to a subscriber package version id (04t) and adds it as a SubscriberPackageVersionId
   *  parameter in the dependency object.
   */
  _retrieveSubscriberPackageVersionId(dependency, branch) {
    return BBPromise.resolve().then(() =>
      this._validateDependencyValues(dependency).then(() => {
        if (dependency.subscriberPackageVersionId) {
          delete dependency.package;

          // if an 04t id is specified just use it.
          return dependency;
        }

        const versionNumber = dependency.versionNumber.split(pkgUtils.VERSION_NUMBER_SEP);
        return this._resolveBuildNumber(versionNumber, dependency.packageId, branch).then(queryResult => {
          const records = queryResult.records;
          if (!records || records.length === 0 || records[0].expr0 == null) {
            throw new Error(
              `No version number was found in Dev Hub for package id ${
                dependency.packageId
              } and branch ${branch} and version number ${versionNumber.join(pkgUtils.VERSION_NUMBER_SEP)}`
            );
          }

          const buildNumber = records[0].expr0;
          const branchString = _.isNil(branch) ? 'null' : `'${branch}'`;
          const query = `SELECT SubscriberPackageVersionId FROM Package2Version WHERE Package2Id = '${dependency.packageId}' AND MajorVersion = ${versionNumber[0]} AND MinorVersion = ${versionNumber[1]} AND PatchVersion = ${versionNumber[2]} AND BuildNumber = ${buildNumber} AND Branch = ${branchString}`;
          return this.force.toolingQuery(this.org, query).then(pkgVerQueryResult => {
            const subRecords = pkgVerQueryResult.records;
            if (!subRecords || subRecords.length !== 1) {
              throw new Error(
                `No version number was found in Dev Hub for package id ${
                  dependency.packageId
                } and branch ${branch} and version number ${versionNumber.join(
                  pkgUtils.VERSION_NUMBER_SEP
                )} that resolved to build number ${buildNumber}`
              );
            }

            dependency.subscriberPackageVersionId = pkgVerQueryResult.records[0].SubscriberPackageVersionId;
            delete dependency.packageId;
            delete dependency.package;
            delete dependency.versionNumber;

            return dependency;
          });
        });
      })
    );
  }

  _resolveBuildNumber(versionNumber, packageId, branch) {
    return BBPromise.resolve().then(() => {
      if (versionNumber[3] === pkgUtils.LATEST_BUILD_NUMBER_TOKEN) {
        // branch?
        const branchString = _.isNil(branch) ? 'null' : `'${branch}'`;
        const query = `SELECT MAX(BuildNumber) FROM Package2Version WHERE Package2Id = '${packageId}' AND MajorVersion = ${versionNumber[0]} AND MinorVersion = ${versionNumber[1]} AND PatchVersion = ${versionNumber[2]} AND branch=${branchString}`;
        return this.force.toolingQuery(this.org, query);
      } else {
        // The build number is already specified so just return it using the tooling query result obj structure
        return { records: [{ expr0: versionNumber[3] }] };
      }
    });
  }

  _createRequestObject(packageId, context, preserveFiles, packageVersTmpRoot, packageVersBlobZipFile) {
    const zipFileBase64 = fs.readFileSync(packageVersBlobZipFile).toString('base64');
    const requestObject = {
      Package2Id: packageId,
      VersionInfo: zipFileBase64,
      Tag: context.flags.tag,
      Branch: context.flags.branch,
      InstallKey: context.flags.installationkey,
      Instance: context.flags.buildinstance,
      SourceOrg: context.flags.sourceorg,
      CalculateCodeCoverage: context.flags.codecoverage,
      SkipValidation: context.flags.skipvalidation
    };

    if (preserveFiles) {
      logger.log(messages.getMessage('tempFileLocation', [packageVersTmpRoot], 'package_version_create'));
      return requestObject;
    } else {
      return fs.removeAsync(packageVersTmpRoot).then(() => requestObject);
    }
  }

  _getPackageDescriptorJsonFromPackageId(packageId, flags) {
    const artDir = flags.path;

    const packageDescriptorJson = this.packageDirs.find(packageDir => {
      const packageDirPackageId = pkgUtils.getPackageIdFromAlias(packageDir.package, this.force);
      return !_.isNil(packageDirPackageId) && packageDirPackageId === packageId ? packageDir : null;
    });

    if (!packageDescriptorJson) {
      throw new Error(`${consts.WORKSPACE_CONFIG_FILENAME} does not contain a packaging directory for ${artDir}`);
    }

    return packageDescriptorJson;
  }

  /**
   * Convert the list of command line options to a JSON object that can be used to create an Package2VersionCreateRequest entity.
   * @param context
   * @param packageId
   * @returns {{Package2Id: (*|p|boolean), Package2VersionMetadata: *, Tag: *, Branch: number}}
   * @private
   */
  _createPackageVersionCreateRequestFromOptions(context, packageId) {
    const artDir = context.flags.path;
    const preserveFiles = !util.isNullOrUndefined(
      context.flags.preserve || process.env.SFDX_PACKAGE2_VERSION_CREATE_PRESERVE
    );
    const uniqueHash = crypto
      .createHash('sha1')
      .update(`${Date.now()}${Math.random()}`)
      .digest('hex');
    const packageVersTmpRoot = path.join(os.tmpdir(), `${packageId}-${uniqueHash}`);
    const packageVersMetadataFolder = path.join(packageVersTmpRoot, 'md-files');
    const packageVersProfileFolder = path.join(packageVersMetadataFolder, 'profiles');
    const packageVersBlobDirectory = path.join(packageVersTmpRoot, 'package-version-info');
    const metadataZipFile = path.join(packageVersBlobDirectory, 'package.zip');
    const settingsZipFile = path.join(packageVersBlobDirectory, 'settings.zip');
    const packageVersBlobZipFile = path.join(packageVersTmpRoot, 'package-version-info.zip');
    const sourceBaseDir = path.join(context.org.force.getConfig().getProjectPath(), artDir);

    const mdOptions = {
      deploydir: packageVersMetadataFolder,
      sourcedir: sourceBaseDir
    };

    const settingsGenerator = new SettingsGenerator();

    // Copy all of the metadata from the workspace to a tmp folder
    return (
      this._generateMDFolderForArtifact(mdOptions)
        .then(async () => {
          const packageDescriptorJson = this._getPackageDescriptorJsonFromPackageId(packageId, context.flags);

          if (Object.prototype.hasOwnProperty.call(packageDescriptorJson, 'package')) {
            delete packageDescriptorJson.package;
            packageDescriptorJson.id = packageId;
          }

          const definitionFile = context.flags.definitionfile
            ? context.flags.definitionfile
            : packageDescriptorJson['definitionFile'];
          if (definitionFile) {
            // package2-descriptor.json sent to the server should contain only the features, snapshot & orgPreferences
            // defined in the definition file.
            delete packageDescriptorJson.features;
            delete packageDescriptorJson.orgPreferences;
            delete packageDescriptorJson.definitionFile;
            delete packageDescriptorJson.snapshot;

            const definitionFilePayload = await fs.readFileAsync(definitionFile, 'utf8');
            const definitionFileJson = JSON.parse(definitionFilePayload);
            const pkgProperties = ['country', 'edition', 'language', 'features', 'orgPreferences', 'snapshot'];

            // Load any settings from the definition
            await settingsGenerator.extract(definitionFileJson);

            if (settingsGenerator.hasSettings() && definitionFileJson['orgPreferences']) {
              // this is not allowed, exit with an error
              return BBPromise.reject(almError('signupDuplicateSettingsSpecified'));
            }

            pkgProperties.forEach(prop => {
              const propValue = definitionFileJson[prop];
              if (propValue) {
                packageDescriptorJson[prop] = propValue;
              }
            });
          }

          return [packageDescriptorJson];
        })
        .spread(packageDescriptorJson => {
          // All dependencies for the packaging dir should be resolved to an 04t id to be passed to the server.
          // (see _retrieveSubscriberPackageVersionId for details)
          const dependencies = packageDescriptorJson.dependencies;
          const operations = _.isNil(dependencies)
            ? []
            : dependencies.map(dependency =>
                this._retrieveSubscriberPackageVersionId(dependency, context.flags.branch)
              );

          return [
            BBPromise.all(operations),
            pkgUtils.getAncestorId(packageDescriptorJson, this.force, this.org),
            packageDescriptorJson
          ];
        })
        .spread(async (resultValues, ancestorId, packageDescriptorJson) => {
          // If dependencies exist, the resultValues array will contain the dependencies populated with a resolved
          // subscriber pkg version id.
          if (resultValues.length > 0) {
            packageDescriptorJson.dependencies = resultValues;
          }

          this._cleanPackageDescriptorJson(packageDescriptorJson);
          this._setPackageDescriptorJsonValues(packageDescriptorJson, context);

          srcDevUtil.ensureDirectoryExistsSync(packageVersTmpRoot);
          srcDevUtil.ensureDirectoryExistsSync(packageVersBlobDirectory);

          if (Object.prototype.hasOwnProperty.call(packageDescriptorJson, 'ancestorVersion')) {
            delete packageDescriptorJson.ancestorVersion;
          }
          packageDescriptorJson.ancestorId = ancestorId;

          return fs.writeJSONAsync(path.join(packageVersBlobDirectory, DESCRIPTOR_FILE), packageDescriptorJson);
        })
        // As part of the source convert process, the package.xml has been written into the tmp metadata directory.
        // The package.xml may need to be manipulated due to processing profiles in the workspace or additional
        // metadata exclusions. If necessary, read the existing package.xml and then re-write it.
        .then(() => fs.readFileAsync(path.join(packageVersMetadataFolder, 'package.xml'), 'utf8'))
        .then(currentPackageXml =>
          // convert to json
          xml2js.parseStringAsync(currentPackageXml)
        )
        .then(packageJson => {
          srcDevUtil.ensureDirectoryExistsSync(packageVersMetadataFolder);
          srcDevUtil.ensureDirectoryExistsSync(packageVersProfileFolder);

          // Apply any necessary exclusions to typesArr.
          let typesArr = packageJson.Package.types;

          typesArr = this.profileApi.filterAndGenerateProfilesForManifest(typesArr);

          // Next generate profiles and retrieve any profiles that were excluded because they had no matching nodes.
          const excludedProfiles = this.profileApi.generateProfiles(packageVersProfileFolder, {
            Package: { types: typesArr }
          });

          if (excludedProfiles.length > 0) {
            const profileIdx = typesArr.findIndex(e => e.name[0] === 'Profile');
            typesArr[profileIdx].members = typesArr[profileIdx].members.filter(e => excludedProfiles.indexOf(e) === -1);
          }

          packageJson.Package.types = typesArr;

          // Re-write the package.xml in case profiles have been added or removed
          const xmlBuilder = new xml2js.Builder({
            xmldec: { version: '1.0', encoding: 'UTF-8' }
          });
          const xml = xmlBuilder.buildObject(packageJson);
          return fs.writeFileAsync(path.join(packageVersMetadataFolder, 'package.xml'), xml);
        })
        .then(() =>
          // Zip the packageVersMetadataFolder folder and put the zip in {packageVersBlobDirectory}/package.zip
          srcDevUtil.zipDir(packageVersMetadataFolder, metadataZipFile)
        )
        .then(() => {
          // Zip up the expanded settings (if present)
          if (settingsGenerator.hasSettings()) {
            return settingsGenerator
              .createDeployDir(context.org.force.config.apiVersion)
              .then(settingsRoot => srcDevUtil.zipDir(settingsRoot, settingsZipFile));
          }
          return BBPromise.resolve();
        })
        // Zip the Version Info and package.zip files into another zip
        .then(() => srcDevUtil.zipDir(packageVersBlobDirectory, packageVersBlobZipFile))
        .then(() =>
          this._createRequestObject(packageId, context, preserveFiles, packageVersTmpRoot, packageVersBlobZipFile)
        )
    );
  }

  _getPackagePropertyFromPackage(packageDirs, packageValue, context) {
    let foundByPackage = packageDirs.find(x => x['package'] === packageValue);
    let foundById = packageDirs.find(x => x['id'] === packageValue);

    if (foundByPackage && foundById) {
      throw new Error(messages.getMessage('errorPackageAndIdCollision', [], 'package_version_create'));
    }

    // didn't find anything? let's see if we can reverse look up
    if (!foundByPackage && !foundById) {
      // is it an alias?
      const pkgId = pkgUtils.getPackageIdFromAlias(packageValue, this.force);

      if (pkgId === packageValue) {
        // not an alias, or not a valid one, try to reverse lookup an alias in case this is an id
        const aliases = pkgUtils.getPackageAliasesFromId(packageValue, this.force);

        // if we found an alias, try to look that up in the config.
        foundByPackage = aliases.some(alias => packageDirs.find(x => x['package'] === alias));
      } else {
        // it is an alias; try to lookup it's id in the config
        foundByPackage = packageDirs.find(x => x['package'] === pkgId);
        foundById = packageDirs.find(x => x['id'] === pkgId);

        if (!foundByPackage && !foundById) {
          // check if any configs use a different alias to that same id
          const aliases = pkgUtils.getPackageAliasesFromId(pkgId, this.force);
          foundByPackage = aliases.some(alias => {
            const pd = packageDirs.find(x => x['package'] === alias);
            if (pd) {
              // if so, set context.flags.package to be this alias instead of the alternate
              context.flags.package = alias;
            }
            return pd;
          });
        }
      }
      // if we still didn't find anything, throw the error
      if (!foundByPackage && !foundById) {
        throw new Error(messages.getMessage('errorMissingPackage', [pkgId], 'package_version_create'));
      }
    }

    return foundByPackage ? 'package' : 'id';
  }

  _getPackageValuePropertyFromDirectory(context, directoryFlag) {
    const packageValue = this._getConfigPackageDirectoriesValue(
      context,
      this.packageDirs,
      'package',
      'path',
      context.flags.path,
      directoryFlag
    );
    const packageIdValue = this._getConfigPackageDirectoriesValue(
      context,
      this.packageDirs,
      'id',
      'path',
      context.flags.path,
      directoryFlag
    );

    let packagePropVal: any = {};

    if (!packageValue && !packageIdValue) {
      throw new Error(messages.getMessage('errorMissingPackage', [], 'package_version_create'));
    } else if (packageValue && packageIdValue) {
      throw new Error(messages.getMessage('errorPackageAndIdCollision', [], 'package_version_create'));
    } else if (packageValue) {
      packagePropVal = {
        packageProperty: 'package',
        packageValue
      };
    } else {
      packagePropVal = {
        packageProperty: 'id',
        packageValue: packageIdValue
      };
    }

    return packagePropVal;
  }

  /**
   * Returns the property value that corresponds to the propertyToLookup.  This value found for a particular
   * package directory element that matches the knownProperty and knownValue.  In other words, we locate a package
   * directory element whose knownProperty matches the knownValue, then we grab the value for the propertyToLookup
   * and return it.
   * @param context
   * @param packageDirs The list of all the package directories from the sfdx-project.json
   * @param propertyToLookup The property ID whose value we want to find
   * @param knownProperty The JSON property in the packageDirectories that is already known
   * @param knownValue The value that corresponds to the knownProperty in the packageDirectories JSON
   * @param knownFlag The flag details e.g. short/long name, etc. Only used for the error message
   */
  _getConfigPackageDirectoriesValue(context, packageDirs, propertyToLookup, knownProperty, knownValue, knownFlag) {
    let value;
    let packageDir = packageDirs.find(x => x[knownProperty] === knownValue);
    if (!packageDir && knownFlag.name === 'path' && knownValue.endsWith(path.sep)) {
      // if this is the directory flag, try removing the trailing slash added by CLI auto-complete
      const dirWithoutTrailingSlash = knownValue.slice(0, -1);
      packageDir = packageDirs.find(x => x[knownProperty] === dirWithoutTrailingSlash);
      if (packageDir) {
        context.flags.path = dirWithoutTrailingSlash;
      }
    }
    // didn't find it with the package property, try a reverse lookup with alias and id
    if (!packageDir && knownProperty === 'package') {
      const pkgId = pkgUtils.getPackageIdFromAlias(knownValue, this.force);
      if (pkgId !== knownValue) {
        packageDir = packageDirs.find(x => x[knownProperty] === pkgId);
      } else {
        const aliases = pkgUtils.getPackageAliasesFromId(knownValue, this.force);
        aliases.some(alias => {
          packageDir = packageDirs.find(x => x[knownProperty] === alias);
          return packageDir;
        });
      }
    }

    if (packageDir) {
      value = packageDir[propertyToLookup];
    } else {
      throw new Error(
        messages.getMessage(
          'errorNoMatchingPackageDirectory',
          [`--${knownFlag.name} (-${knownFlag.char})`, knownValue, knownProperty],
          'package_version_create'
        )
      );
    }
    return value;
  }

  execute(context) {
    return this._execute(context).catch(err => {
      // TODO
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      err = pkgUtils.massageErrorMessage(err);
      throw pkgUtils.applyErrorAction(err);
    });
  }

  async _execute(context) {
    this.org = context.org;
    this.force = this.org.force;
    this.packageVersionCreateRequestApi = new PackageVersionCreateRequestApi(this.force, this.org);

    if (context.flags.wait) {
      if (context.flags.skipvalidation === true) {
        this.pollInterval = POLL_INTERVAL_WITHOUT_VALIDATION_SECONDS;
      }
      this.maxRetries = (60 / this.pollInterval) * context.flags.wait;
    }

    // This command requires either the ID flag or path flag. The
    // other needed value can be looked up from sfdx-project.json. As
    // this concept is not supported by the framework, manually check if
    // we have at least one of the flags
    const pathFlag = context.command.flags.find(x => x.name === 'path');
    const packageFlag = context.command.flags.find(x => x.name === 'package');
    if (!context.flags.package && !context.flags.path) {
      const errorString = messages.getMessage(
        'errorMissingFlags',
        [`--${packageFlag.name} (-${packageFlag.char})`, `--${pathFlag.name} (-${pathFlag.char})`],
        'package_version_create'
      );
      const error = new Error(errorString);
      error['name'] = 'requiredFlagMissing';
      return BBPromise.reject(error);
    }

    // This command does not allow --codecoverage and --skipvalidation at the same time
    if (context.flags.skipvalidation && context.flags.codecoverage) {
      const codeCovFlag = context.command.flags.find(x => x.name === 'codecoverage');
      const skipValFlag = context.command.flags.find(x => x.name === 'skipvalidation');

      const errorString = messages.getMessage(
        'errorCannotSupplyCodeCoverageAndSkipValidation',
        [
          `--${codeCovFlag.name} (-${codeCovFlag.char})`,
          `--${skipValFlag.name}`,
          `--${codeCovFlag.name} (-${codeCovFlag.char})`,
          `--${skipValFlag.name}`
        ],
        'package_version_create'
      );
      const error = new Error(errorString);
      error['name'] = 'requiredFlagMissing';
      return BBPromise.reject(error);
    }

    // This command also requires either the installationkey flag or installationkeybypass flag
    if (!context.flags.installationkey && !context.flags.installationkeybypass) {
      const installationKeyFlag = context.command.flags.find(x => x.name === 'installationkey');
      const installationKeyBypassFlag = context.command.flags.find(x => x.name === 'installationkeybypass');
      const errorString = messages.getMessage(
        'errorMissingFlagsInstallationKey',
        [
          `--${installationKeyFlag.name} (-${installationKeyFlag.char})`,
          `--${installationKeyBypassFlag.name} (-${installationKeyBypassFlag.char})`
        ],
        'package_version_create'
      );
      const error = new Error(errorString);
      error['name'] = 'requiredFlagMissing';
      return BBPromise.reject(error);
    }

    // For the first rollout of validating sfdx-project.json data against schema, make it optional and defaulted
    // to false. Validation only occurs if the hidden -j (--validateschema) flag has been specified.
    let configContentPromise;
    if (context.flags.validateschema) {
      configContentPromise = context.org.force.config.getConfigContentWithValidation();
    } else {
      configContentPromise = BBPromise.resolve(context.org.force.config.getConfigContent());
    }

    let canonicalPackageProperty;

    // Look up the missing value or confirm a match
    return configContentPromise.then(async configContent => {
      this.packageDirs = configContent.packageDirectories;

      // Check for empty packageDirectories
      if (!this.packageDirs) {
        throw new Error(messages.getMessage('errorEmptyPackageDirs', null, 'package_version_create'));
      }

      if (!context.flags.package) {
        const packageValProp = this._getPackageValuePropertyFromDirectory(context, pathFlag);
        context.flags.package = packageValProp.packageValue;
        canonicalPackageProperty = packageValProp.packageProperty;
      } else if (!context.flags.path) {
        canonicalPackageProperty = this._getPackagePropertyFromPackage(
          this.packageDirs,
          context.flags.package,
          context
        );
        context.flags.path = this._getConfigPackageDirectoriesValue(
          context,
          this.packageDirs,
          'path',
          canonicalPackageProperty,
          context.flags.package,
          packageFlag
        );
      } else {
        canonicalPackageProperty = this._getPackagePropertyFromPackage(
          this.packageDirs,
          context.flags.package,
          context
        );
        this._getConfigPackageDirectoriesValue(
          context,
          this.packageDirs,
          canonicalPackageProperty,
          'path',
          context.flags.path,
          pathFlag
        );
        const expectedPackageId = this._getConfigPackageDirectoriesValue(
          context,
          this.packageDirs,
          canonicalPackageProperty,
          'path',
          context.flags.path,
          pathFlag
        );

        // This will thrown an error if the package id flag value doesn't match
        // any of the :id values in the package dirs.
        this._getConfigPackageDirectoriesValue(
          context,
          this.packageDirs,
          'path',
          canonicalPackageProperty,
          context.flags.package,
          packageFlag
        );

        // This will thrown an error if the package id flag value doesn't match
        // the correct corresponding directory with that packageId.
        if (context.flags.package !== expectedPackageId) {
          throw new Error(
            messages.getMessage(
              'errorDirectoryIdMismatch',
              [
                `--${pathFlag.name} (-${pathFlag.char})`,
                context.flags.path,
                `--${packageFlag.name} (-${packageFlag.char})`,
                context.flags.package
              ],
              'package_version_create'
            )
          );
        }
      }

      const resolvedPackageId = pkgUtils.getPackageIdFromAlias(context.flags.package, this.force);

      // At this point, the packageIdFromAlias should have been resolved to an Id.  Now, we
      // need to validate that the Id is correct.
      pkgUtils.validateId(pkgUtils.BY_LABEL.PACKAGE_ID, resolvedPackageId);

      await this._validateFlagsForPackageType(resolvedPackageId, context.flags);

      // validate the versionNumber flag value if specified, otherwise the descriptor value
      const versionNumber = context.flags.versionnumber
        ? context.flags.versionnumber
        : this._getConfigPackageDirectoriesValue(
            context,
            this.packageDirs,
            'versionNumber',
            canonicalPackageProperty,
            context.flags.package,
            packageFlag
          );

      pkgUtils.validateVersionNumber(versionNumber, pkgUtils.NEXT_BUILD_NUMBER_TOKEN);
      await pkgUtils.validatePatchVersion(this.force, this.org, versionNumber, resolvedPackageId);

      try {
        fs.statSync(path.join(process.cwd(), context.flags.path));
      } catch (err) {
        throw new Error(`Directory '${context.flags.path}' does not exist`);
      }

      // Check for an includeProfileUserLiceneses flag in the packageDirectory
      const includeProfileUserLicenses = this._getConfigPackageDirectoriesValue(
        context,
        this.packageDirs,
        'includeProfileUserLicenses',
        canonicalPackageProperty,
        context.flags.package,
        packageFlag
      );
      if (
        includeProfileUserLicenses !== undefined &&
        includeProfileUserLicenses !== true &&
        includeProfileUserLicenses !== false
      ) {
        throw new Error(
          messages.getMessage(
            'errorProfileUserLicensesInvalidValue',
            [includeProfileUserLicenses],
            'package_version_create'
          )
        );
      }
      this.profileApi = new ProfileApi(this.org, includeProfileUserLicenses);

      // If we are polling check to see if the package is Org-Dependent, if so, update the poll time
      if (context.flags.wait) {
        const query = `SELECT IsOrgDependent FROM Package2 WHERE Id = '${resolvedPackageId}'`;
        this.force.toolingQuery(this.org, query).then(pkgQueryResult => {
          const subRecords = pkgQueryResult.records;
          if (subRecords && subRecords.length === 1 && subRecords[0].IsOrgDependent) {
            this.pollInterval = POLL_INTERVAL_WITHOUT_VALIDATION_SECONDS;
            this.maxRetries = (60 / this.pollInterval) * context.flags.wait;
          }
        });
      }

      return Promise.resolve().then(() =>
        this._createPackageVersionCreateRequestFromOptions(context, resolvedPackageId)
          .then(request => this.force.toolingCreate(this.org, 'Package2VersionCreateRequest', request))
          .then(createResult => {
            if (createResult.success) {
              return createResult.id;
            } else {
              const errStr =
                createResult.errors && createResult.errors.length
                  ? createResult.errors.join(', ')
                  : createResult.errors;
              throw new Error(`Failed to create request${createResult.id ? ` [${createResult.id}]` : ''}: ${errStr}`);
            }
          })
          .then(id => {
            if (context.flags.wait) {
              if (this.pollInterval) {
                return pkgUtils.pollForStatusWithInterval(
                  context,
                  id,
                  this.maxRetries,
                  resolvedPackageId,
                  logger,
                  true,
                  this.force,
                  this.org,
                  this.pollInterval
                );
              } else {
                return pkgUtils.pollForStatus(
                  context,
                  id,
                  this.maxRetries,
                  resolvedPackageId,
                  logger,
                  true,
                  this.force,
                  this.org
                );
              }
            } else {
              return this.packageVersionCreateRequestApi.byId(id);
            }
          })
          .then(result => (util.isArray(result) ? result[0] : result))
      );
    });
  }

  public rejectWithInstallKeyError(context: any) {
    // This command also requires either the installationkey flag or installationkeybypass flag
    const installationKeyFlag = context.command.flags.find(x => x.name === 'installationkey');
    const installationKeyBypassFlag = context.command.flags.find(x => x.name === 'installationkeybypass');
    const errorString = messages.getMessage(
      'errorMissingFlagsInstallationKey',
      [
        `--${installationKeyFlag.name} (-${installationKeyFlag.char})`,
        `--${installationKeyBypassFlag.name} (-${installationKeyBypassFlag.char})`
      ],
      'package_version_create'
    );
    const error = new Error(errorString);
    error['name'] = 'requiredFlagMissing';
    return BBPromise.reject(error);
  }

  async _validateFlagsForPackageType(packageId: string, flags: any) {
    let packageType = await pkgUtils.getPackage2Type(packageId, this.force, this.org);

    if (packageType == 'Unlocked') {
      if (flags.postinstallscript || flags.uninstallscript) {
        throw SfdxError.create(
          'salesforce-alm',
          'packaging',
          'version_create.errorScriptsNotApplicableToUnlockedPackage'
        );
      }

      // Don't allow ancestor in unlocked packages

      const packageDescriptorJson = this._getPackageDescriptorJsonFromPackageId(packageId, flags);

      let ancestorId = packageDescriptorJson.ancestorId;
      let ancestorVersion = packageDescriptorJson.ancestorVersion;

      if (ancestorId || ancestorVersion) {
        throw SfdxError.create(
          'salesforce-alm',
          'packaging',
          'version_create.errorAncestorNotApplicableToUnlockedPackage'
        );
      }
    }
  }

  /**
   *
   * @param result - the data representing the Package Version, must include a 'Status' property
   * @returns {string} a human readable message for CLI output
   */
  getHumanSuccessMessage(result) {
    switch (result.Status) {
      case 'Error':
        return result.Error.length > 0
          ? result.Error.join('\n')
          : messages.getMessage('unknownError', [], 'package_version_create');
      case 'Success':
        return messages.getMessage(
          result.Status,
          [result.Id, result.SubscriberPackageVersionId, pkgUtils.INSTALL_URL_BASE, result.SubscriberPackageVersionId],
          'package_version_create'
        );
      default:
        return messages.getMessage(
          'InProgress',
          [pkgUtils.convertCamelCaseStringToSentence(result.Status), result.Id],
          'package_version_create'
        );
    }
  }

  /**
   * Cleans invalid attribute(s) from the packageDescriptorJSON
   */
  _cleanPackageDescriptorJson(packageDescriptorJson) {
    if (typeof packageDescriptorJson.default !== 'undefined') {
      delete packageDescriptorJson.default; // for client-side use only, not needed
    }
    if (typeof packageDescriptorJson.includeProfileUserLicenses !== 'undefined') {
      delete packageDescriptorJson.includeProfileUserLicenses; // for client-side use only, not needed
    }
  }

  /**
   * Sets default or override values for packageDescriptorJSON attribs
   */
  _setPackageDescriptorJsonValues(packageDescriptorJson, context) {
    if (context.flags.versionname) {
      packageDescriptorJson.versionName = context.flags.versionname;
    }
    if (context.flags.versiondescription) {
      packageDescriptorJson.versionDescription = context.flags.versiondescription;
    }
    if (context.flags.versionnumber) {
      packageDescriptorJson.versionNumber = context.flags.versionnumber;
    }

    // default versionName to versionNumber if unset, stripping .NEXT if present
    if (!packageDescriptorJson.versionName) {
      const versionNumber = packageDescriptorJson.versionNumber;
      packageDescriptorJson.versionName =
        versionNumber.split(pkgUtils.VERSION_NUMBER_SEP)[3] === pkgUtils.NEXT_BUILD_NUMBER_TOKEN
          ? versionNumber.substring(
              0,
              versionNumber.indexOf(pkgUtils.VERSION_NUMBER_SEP + pkgUtils.NEXT_BUILD_NUMBER_TOKEN)
            )
          : versionNumber;
      logger.warnUser(
        context,
        messages.getMessage('defaultVersionName', packageDescriptorJson.versionName, 'package_version_create')
      );
    }

    if (context.flags.releasenotesurl) {
      packageDescriptorJson.releaseNotesUrl = context.flags.releasenotesurl;
    }
    if (packageDescriptorJson.releaseNotesUrl && !pkgUtils.validUrl(packageDescriptorJson.releaseNotesUrl)) {
      throw new Error(
        messages.getMessage(
          'malformedUrl',
          ['releaseNotesUrl', packageDescriptorJson.releaseNotesUrl],
          'package_version_create'
        )
      );
    }

    if (context.flags.postinstallurl) {
      packageDescriptorJson.postInstallUrl = context.flags.postinstallurl;
    }
    if (packageDescriptorJson.postInstallUrl && !pkgUtils.validUrl(packageDescriptorJson.postInstallUrl)) {
      throw new Error(
        messages.getMessage(
          'malformedUrl',
          ['postInstallUrl', packageDescriptorJson.postInstallUrl],
          'package_version_create'
        )
      );
    }

    if (context.flags.postinstallscript) {
      packageDescriptorJson.postInstallScript = context.flags.postinstallscript;
    }
    if (context.flags.uninstallscript) {
      packageDescriptorJson.uninstallScript = context.flags.uninstallscript;
    }
  }
}

export = PackageVersionCreateCommand;

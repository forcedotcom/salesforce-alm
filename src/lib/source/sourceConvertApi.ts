/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';

// 3pp
import * as BBPromise from 'bluebird';
import * as _ from 'lodash';
import { fs } from '@salesforce/core';
import { copy } from 'fs-extra';

// Local
import MetadataRegistry = require('./metadataRegistry');
import srcDevUtil = require('../core/srcDevUtil');
import * as sourceState from './sourceState';
import * as sourceUtil from './sourceUtil';
import Messages = require('../messages');
const messages = Messages();
import { MetadataTypeFactory } from './metadataTypeFactory';
import { ForceIgnore } from './forceIgnore';
import * as almError from '../core/almError';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { AggregateSourceElements } from './aggregateSourceElements';
import * as SourceUtil from './sourceUtil';
import { SfdxError } from '@salesforce/core';
import { SourceElementsResolver } from './sourceElementsResolver';

class SourceConvertApi {
  static revert?: boolean;
  static err?: Error;

  // TODO: proper property typing
  [property: string]: any;

  constructor(org: any, swa?: SourceWorkspaceAdapter) {
    this.sourceWorkspaceAdapter = swa;
    this.scratchOrg = org;
    this.projectDir = this.scratchOrg.config.getProjectPath();
    this.forceIgnore = new ForceIgnore();
  }

  /**
   *   Takes an array of strings, surrounds each string with single quotes, then joins the values.
   *   Used for building a query condition. E.g., WHERE MemberName IN ('Foo','Bar')
   *   The server uses '/' file path separators, but on windows we could be passed 'Reports\ReportA' we need to change this
   */
  static singleQuoteJoin(arr: Array<string>): string {
    return arr.map(val => `'${val.replace('\\', '/')}'`).join();
  }

  private async initWorkspaceAdapter(): Promise<void> {
    if (!this.sourceWorkspaceAdapter) {
      const options: SourceWorkspaceAdapter.Options = {
        org: this.scratchOrg,
        metadataRegistryImpl: MetadataRegistry,
        defaultPackagePath: this.scratchOrg.config.getAppConfig().defaultPackagePath,
        fromConvert: true
      };
      this.sourceWorkspaceAdapter = await SourceWorkspaceAdapter.create(options);
    }
  }

  // Convert files in source format to mdapi format and create a package.xml.
  public async doConvert(context): Promise<any[]> {
    const { rootDir, manifest, metadata, sourcepath, outputDir, packagename, unsupportedMimeTypes } = context;

    await this.initWorkspaceAdapter();

    try {
      await fs.access(rootDir, fs.constants.R_OK);
    } catch (err) {
      // Throw a more helpful error when the rootDir is invalid; otherwise rethrow.
      if (err.code === 'ENOENT') {
        throw new SfdxError(messages.getMessage('invalidRootDirectory', [rootDir], 'sourceConvertCommand'));
      }
      throw err;
    }

    const sourceElementsResolver = new SourceElementsResolver(this.scratchOrg, this.sourceWorkspaceAdapter);
    let sourceElements = new AggregateSourceElements();

    if (manifest) {
      sourceElements = await sourceElementsResolver.getSourceElementsFromManifest(manifest);
    } else if (sourcepath) {
      sourceElements = await SourceUtil.getSourceElementsFromSourcePath(sourcepath, this.sourceWorkspaceAdapter);
    } else if (metadata) {
      sourceElements = await sourceElementsResolver.getSourceElementsFromMetadata(
        context,
        new AggregateSourceElements()
      );
    } else {
      sourceElements = await this.sourceWorkspaceAdapter.getAggregateSourceElements(false, rootDir);
    }

    if (sourceElements.isEmpty()) {
      throw new Error(messages.getMessage('noSourceInRootDirectory', [], 'sourceConvertCommand'));
    }

    return this.convertSourceToMdapi(outputDir, packagename, sourceElements, false, unsupportedMimeTypes);
  }

  public async convertSourceToMdapi(
    targetPath: string,
    packageName: string,
    aggregateSourceElementsMap: AggregateSourceElements,
    createDestructiveChangesManifest: boolean,
    unsupportedMimeTypes,
    isSourceDelete?: boolean
  ) {
    let destructiveChangesTypeNamePairs = [];
    let sourceElementsForMdDir;
    return this.initWorkspaceAdapter()
      .then(() => aggregateSourceElementsMap.getAllSourceElements())
      .then(aggregateSourceElements => {
        [destructiveChangesTypeNamePairs, sourceElementsForMdDir] = SourceConvertApi.sortSourceElementsForMdDeploy(
          aggregateSourceElements,
          this.sourceWorkspaceAdapter.metadataRegistry
        );
        return SourceConvertApi.populateMdDir(
          targetPath,
          sourceElementsForMdDir,
          unsupportedMimeTypes,
          this.forceIgnore
        );
      })
      .then(() => {
        if (createDestructiveChangesManifest && destructiveChangesTypeNamePairs.length) {
          // Build a tooling query for all SourceMembers with MemberNames matching the locally deleted names.
          const deletedMemberNames = _.map(destructiveChangesTypeNamePairs, 'name');
          const conditions = `MemberName IN (${SourceConvertApi.singleQuoteJoin(deletedMemberNames)})`;
          const fields = ['MemberType', 'MemberName', 'IsNameObsolete'];
          if (isSourceDelete) {
            return SourceConvertApi.createPackageManifests(
              targetPath,
              packageName,
              destructiveChangesTypeNamePairs,
              sourceElementsForMdDir,
              this.scratchOrg,
              this.sourceWorkspaceAdapter.metadataRegistry
            );
          }
          return this.scratchOrg.force
            .toolingFind(this.scratchOrg, 'SourceMember', conditions, fields)
            .then(sourceMembers => {
              if (!sourceMembers.length) {
                // No members exist on the server (i.e., empty scratch org) so don't try to delete anything.
                destructiveChangesTypeNamePairs = [];
              } else {
                // Filter destructive changes to only the members found on the server that haven't already been deleted.
                destructiveChangesTypeNamePairs = _.filter(destructiveChangesTypeNamePairs, removal =>
                  _.some(sourceMembers, {
                    MemberType: removal.type,
                    MemberName: removal.name,
                    IsNameObsolete: false
                  })
                );
              }
            })
            .then(() => {
              destructiveChangesTypeNamePairs.forEach(destructive => {
                // On windows, the name could be 'Report\\ReportA', so we need to change to match what the server wants
                destructive.name.replace('\\\\', '/');
              });
            })
            .then(() =>
              SourceConvertApi.createPackageManifests(
                targetPath,
                packageName,
                destructiveChangesTypeNamePairs,
                sourceElementsForMdDir,
                this.scratchOrg,
                this.sourceWorkspaceAdapter.metadataRegistry
              )
            );
        }
        return SourceConvertApi.createPackageManifests(
          targetPath,
          packageName,
          [],
          sourceElementsForMdDir,
          this.scratchOrg,
          this.sourceWorkspaceAdapter.metadataRegistry
        );
      })
      .then(() => [sourceElementsForMdDir, destructiveChangesTypeNamePairs]);
  }

  /**
   * Sorts the source elements into those that should be added to the destructiveChangesPost.xml
   * and those that should be added to the package.xml
   * @returns {[[],[]]} - the array of destructive changes and the array of elements to be added to the package.xml
   * @private
   */
  static sortSourceElementsForMdDeploy(aggregateSourceElements, metadataRegistry: MetadataRegistry) {
    const destructiveChangeTypeNamePairs = [];
    const updatedSourceElements = [];
    aggregateSourceElements.forEach(aggregateSourceElement => {
      if (aggregateSourceElement.isDeleted()) {
        if (!aggregateSourceElement.getMetadataType().deleteSupported(aggregateSourceElement.getAggregateFullName())) {
          return;
        }

        // if the whole source element should be deleted, then there's no need to process each pending workspace file
        destructiveChangeTypeNamePairs.push({
          type: aggregateSourceElement.getMetadataName(),
          name: aggregateSourceElement.getAggregateFullName()
        });
      } else {
        let aggregateSourceElementWasChanged = false;
        const aggregateMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
          aggregateSourceElement.getMetadataName(),
          metadataRegistry
        );

        if (!aggregateMetadataType.hasIndividuallyAddressableChildWorkspaceElements()) {
          aggregateSourceElementWasChanged = true;
        } else {
          aggregateSourceElement.getWorkspaceElements().forEach(workspaceElement => {
            const workspaceElementMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
              workspaceElement.getMetadataName(),
              metadataRegistry
            );
            if (
              workspaceElement.getDeleteSupported() &&
              workspaceElement.getState() === sourceState.DELETED &&
              workspaceElementMetadataType.isAddressable()
            ) {
              destructiveChangeTypeNamePairs.push({
                type: workspaceElement.getMetadataName(),
                name: workspaceElement.getFullName()
              });
            } else {
              aggregateSourceElementWasChanged = true;
            }
          });
        }
        if (aggregateSourceElementWasChanged) {
          updatedSourceElements.push(aggregateSourceElement);
        }
      }
    });

    return [destructiveChangeTypeNamePairs, updatedSourceElements];
  }

  static async populateMdDir(targetPath, aggregateSourceElements, unsupportedMimeTypes?, forceIgnore?) {
    // Create the metadata deploy root directory
    srcDevUtil.ensureDirectoryExistsSync(targetPath);
    const decompositionDir = await sourceUtil.createOutputDir('decomposition');

    const translationsMap = {};
    return BBPromise.map(aggregateSourceElements, element =>
      element
        .getFilePathTranslations(targetPath, decompositionDir, unsupportedMimeTypes, forceIgnore)
        .then(translations =>
          BBPromise.map(translations, translation => {
            // check for duplicates since fs.copyAsync will throw an EEXIST error on duplicate files/dirs
            if (util.isNullOrUndefined(translationsMap[translation.mdapiPath])) {
              translationsMap[translation.mdapiPath] = translation.sourcePath;
              return BBPromise.resolve(translation.sourcePath)
                .then(sourcePath => copy(sourcePath, translation.mdapiPath))
                .catch(err => {
                  if (err.code === 'ENOENT') {
                    throw almError('MissingContentOrMetadataFile', translation.sourcePath);
                  }
                  throw err;
                });
            } else {
              return BBPromise.resolve();
            }
          }).catch(err => {
            this.revert = true;
            this.err = err;
          })
        )
    ).then(() => {
      if (this.revert !== undefined) {
        srcDevUtil.deleteDirIfExistsSync(targetPath);
        throw this.err;
      }
      /** MD types like static resources might have a zip file created which need to be deleted after conversion to MD format*/
      if (srcDevUtil.getZipDirPath()) {
        srcDevUtil.deleteIfExistsSync(srcDevUtil.getZipDirPath());
      }
      return sourceUtil.cleanupOutputDir(decompositionDir);
    });
  }

  static createPackageManifests(
    outputdir,
    packageName,
    destructiveChangesTypeNamePairs,
    updatedAggregateSourceElements,
    scratchOrg,
    metadataRegistry?
  ) {
    const updatedTypeNamePairs = SourceConvertApi.getUpdatedSourceTypeNamePairs(
      updatedAggregateSourceElements,
      metadataRegistry
    );

    const configSourceApiVersion = scratchOrg.config.getAppConfig().sourceApiVersion;
    const sourceApiVersion = configSourceApiVersion || scratchOrg.config.getApiVersion();
    const ManifestCreateApi = require('./manifestCreateApi'); // eslint-disable-line global-require

    // TODO: This should come from source tracking database
    const manifestCreateApi = new ManifestCreateApi(scratchOrg);
    // Create the package.xml
    return manifestCreateApi
      .createManifest({ outputdir, sourceApiVersion }, packageName, updatedTypeNamePairs)
      .then(() => {
        if (destructiveChangesTypeNamePairs.length > 0) {
          // Create the destructiveChangesPost.xml
          return manifestCreateApi.createManifest(
            {
              outputdir,
              sourceApiVersion,
              outputfile: 'destructiveChangesPost.xml'
            },
            packageName,
            destructiveChangesTypeNamePairs
          );
        } else {
          return BBPromise.resolve();
        }
      });
  }

  static getUpdatedSourceTypeNamePairs(updatedAggregateSourceElements, metadataRegistry) {
    const keys = new Set();
    return updatedAggregateSourceElements
      .map(se => ({
        type: se.getMetadataName(),
        name: se.getAggregateFullName(),
        workspaceElements: se.getWorkspaceElements()
      }))
      .reduce((typeNamePairs, typeNamePair) => {
        const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(typeNamePair.type, metadataRegistry);
        if (metadataType.hasIndividuallyAddressableChildWorkspaceElements()) {
          typeNamePair.workspaceElements.forEach(workspaceElement => {
            const workspaceElementMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
              workspaceElement.getMetadataName(),
              metadataRegistry
            );

            if (workspaceElement.getState() !== sourceState.DELETED && workspaceElementMetadataType.isAddressable()) {
              SourceConvertApi.addNoDupes(
                typeNamePairs,
                {
                  type: workspaceElement.getMetadataName(),
                  name: workspaceElement.getFullName()
                },
                keys
              );
            }
          });
        } else {
          SourceConvertApi.addNoDupes(typeNamePairs, typeNamePair, keys);
          if (metadataType.requiresIndividuallyAddressableMembersInPackage()) {
            metadataType.getChildMetadataTypes().forEach(childMetadataType => {
              SourceConvertApi.addNoDupes(typeNamePairs, { type: childMetadataType, name: '*' }, keys);
            });
          }
        }
        return typeNamePairs;
      }, []);
  }

  static addNoDupes(typeNamePairs, typeNamePair, keys) {
    const key = `${typeNamePair.type}#${typeNamePair.name}`;
    if (!keys.has(key)) {
      typeNamePairs.push(typeNamePair);
      keys.add(key);
    }
  }
}

export = SourceConvertApi;

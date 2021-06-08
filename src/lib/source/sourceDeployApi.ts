/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as os from 'os';
import cli from 'cli-ux';

// Node
import * as fsExtra from 'fs-extra';

// Local
import { Logger, SfdxError, Messages, fs, SfdxProject } from '@salesforce/core';
import MdapiDeployApi = require('../mdapi/mdapiDeployApi');
import consts = require('../core/constants');
import MetadataRegistry = require('./metadataRegistry');
import * as syncCommandHelper from './syncCommandHelper';
import { WorkspaceFileState } from './workspaceFileState';

import { MetadataTypeFactory } from './metadataTypeFactory';
import { SourceDeployApiBase } from './sourceDeployApiBase';
import { WorkspaceElementObj } from './workspaceElement';
import { getSourceElementsFromSourcePath, createOutputDir, cleanupOutputDir } from './sourceUtil';
import { AggregateSourceElement } from './aggregateSourceElement';
import { AggregateSourceElements } from './aggregateSourceElements';
import * as PathUtils from './sourcePathUtil';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { SourceElementsResolver } from './sourceElementsResolver';

export interface DeployResult {
  outboundFiles: WorkspaceElementObj[];
  deploys?: any[];
  userCanceled?: boolean;
}

export class SourceDeployApi extends SourceDeployApiBase {
  private swa: SourceWorkspaceAdapter;
  private isDelete: boolean;
  private tmpBackupDeletions;
  private DELETE_NOT_SUPPORTED_IN_CONTENT = ['StaticResource'];
  static packagesDeployed: number;

  // @todo we shouldn't cross the command api separation by re-using cli options as dependencies for the api.
  async doDeploy(options): Promise<DeployResult> {
    let aggregateSourceElements = new AggregateSourceElements();
    this.isDelete = options.delete;
    this.logger = await Logger.child('SourceDeployApi');

    this.isAsync = options.wait === consts.MIN_SRC_DEPLOY_WAIT_MINUTES;

    // Only put SWA in stateless mode when sourcepath param is used.
    const mode = options.sourcepath && SourceWorkspaceAdapter.modes.STATELESS;
    this.logger.debug(`mode: ${mode}`);

    const sfdxProject = SfdxProject.getInstance();

    const swaOptions: SourceWorkspaceAdapter.Options = {
      org: this.orgApi,
      metadataRegistryImpl: MetadataRegistry,
      defaultPackagePath: sfdxProject.getDefaultPackage().name,
      fromConvert: true,
      sourceMode: mode,
    };
    this.swa = await SourceWorkspaceAdapter.create(swaOptions);
    const packageNames = sfdxProject.getUniquePackageNames();

    const tmpOutputDir = await createOutputDir('sourceDeploy');

    try {
      const sourceElementsResolver = new SourceElementsResolver(this.orgApi, this.swa);
      if (options.sourcepath) {
        this.logger.info(`Deploying metadata in sourcepath '${options.sourcepath}' to org: '${this.orgApi.name}'`);
        aggregateSourceElements = await getSourceElementsFromSourcePath(options.sourcepath, this.swa);

        // sourcepaths can be outside of a packageDirectory, in which case the packageName will be undefined.
        // Add `undefined` as a valid package to deploy for this case.
        packageNames.push(undefined);
      } else if (options.manifest) {
        this.logger.info(`Deploying metadata in manifest '${options.manifest}' to org: '${this.orgApi.name}'`);
        aggregateSourceElements = await sourceElementsResolver.getSourceElementsFromManifest(options.manifest);
      } else if (options.metadata) {
        aggregateSourceElements = await sourceElementsResolver.getSourceElementsFromMetadata(
          options,
          aggregateSourceElements,
          tmpOutputDir
        );
      } else if (options.validateddeployrequestid) {
        // this is a quick deploy
        return new MdapiDeployApi(this.orgApi).deploy(options);
      } else {
        // This should never happen but just a little OC - 'else if' without an 'else'
        throw SfdxError.create('salesforce-alm', 'source', 'missingScopeOption');
      }

      SourceDeployApi.packagesDeployed = aggregateSourceElements.size;
      let _handleDeleteResult = false;
      if (this.isDelete) {
        if (options.sourcepath) {
          _handleDeleteResult = await this._handleDelete(options.noprompt, aggregateSourceElements, options.sourcepath);
        } else {
          // if it is the metadata option, options.sourcepath was empty. Create a path to the "source" from the MD name
          _handleDeleteResult = await this._handleDelete(
            options.noprompt,
            aggregateSourceElements,
            path.join(this.swa.defaultSrcDir, 'aura', options.metadata.split(':').pop())
          );
        }

        if (!_handleDeleteResult) {
          return { outboundFiles: [], userCanceled: true };
        }
      }

      if (isNaN(options.wait)) {
        options.wait = this.force.config.getConfigContent().defaultSrcWaitMinutes;
      }

      const results: DeployResult = { outboundFiles: [], deploys: [] };

      if (aggregateSourceElements.size > 0) {
        // Deploy AggregateSourceElements in the order specified within the project config.
        for (const pkgName of packageNames) {
          const aseMap = aggregateSourceElements.get(pkgName);
          if (aseMap && aseMap.size) {
            this.logger.info('deploying package:', pkgName);
            let tmpPkgOutputDir: string;

            // Clone the options object passed to this.doDeploy so options don't
            // leak from 1 package deploy to the next.
            const deployOptions = Object.assign({}, options);

            try {
              // Create a temp directory
              tmpPkgOutputDir = await createOutputDir('sourceDeploy_pkg');
              deployOptions.deploydir = tmpPkgOutputDir;
              // change the manifest path to point to the package.xml from the
              // package tmp deploy dir
              deployOptions.manifest = path.join(tmpPkgOutputDir, 'package.xml');
              deployOptions.ignorewarnings = deployOptions.ignorewarnings || this.isDelete;

              const _ases = new AggregateSourceElements().set(pkgName, aseMap);

              if (!deployOptions.checkonly) {
                await this._doLocalDelete(_ases);
              }

              let result = await this.convertAndDeploy(deployOptions, this.swa, _ases, this.isDelete);

              // If we are only checking the metadata deploy, return what `mdapi:deploy` returns.
              // Otherwise process results and return similar to `source:push`
              if (!deployOptions.checkonly && !this.isAsync) {
                result = await this._processResults(result, _ases, deployOptions.deploydir);
              }
              // NOTE: This object assign is unfortunate and wrong, but we have to do it to maintain
              // JSON output backwards compatibility between pre-mpd and mpd deploys.
              const outboundFiles = results.outboundFiles;
              Object.assign(results, result);
              if (result.outboundFiles && result.outboundFiles.length) {
                results.outboundFiles = [...outboundFiles, ...result.outboundFiles];
              }

              results.deploys.push(result);
            } finally {
              // Remove the sourcePathInfos.json file and delete any temp dirs
              this.orgApi.getSourcePathInfos().delete();
              await cleanupOutputDir(tmpPkgOutputDir);
              await cleanupOutputDir(this.tmpBackupDeletions);
            }
          }
        }
      }
      return results;
    } finally {
      await cleanupOutputDir(tmpOutputDir);
    }
  }

  private async _doLocalDelete(ases: AggregateSourceElements) {
    this.tmpBackupDeletions = await createOutputDir('sourceDelete');
    const cleanedCache = new Map<string, boolean>();
    ases.getAllSourceElements().forEach((ase: AggregateSourceElement) => {
      ase
        .getPendingDeletedWorkspaceElements()
        .forEach((we) =>
          fsExtra.copySync(we.getSourcePath(), path.join(this.tmpBackupDeletions, path.basename(we.getSourcePath())))
        );
      ase.commitDeletes([]);
      const dirname = path.dirname(ase.getMetadataFilePath());
      if (!cleanedCache.get(dirname)) {
        const contentPaths = ase.getContentPaths(ase.getMetadataFilePath());
        contentPaths.forEach((content) => {
          if (content.includes('__tests__') && content.includes('lwc')) {
            fs.unlinkSync(content);
          }
        });

        // This should only be called once per type. For example if there are 1000 static resources then
        // cleanEmptyDirs should be called once not 1000 times.
        PathUtils.cleanEmptyDirs(dirname);
        cleanedCache.set(dirname, true);
      }
    });
  }

  private async _handleDelete(noprompt: boolean, ases: AggregateSourceElements, sourcepath: string) {
    let pendingDelPathsForPrompt = [];
    const typedefObj = MetadataTypeFactory.getMetadataTypeFromSourcePath(sourcepath, this.swa.metadataRegistry);
    const metadataType = typedefObj ? typedefObj.getMetadataName() : null;

    /** delete of static resources file is not supported by cli */

    if (this.DELETE_NOT_SUPPORTED_IN_CONTENT.includes(metadataType)) {
      const data = fsExtra.statSync(sourcepath);
      if (data.isFile()) {
        throw SfdxError.create('salesforce-alm', 'source', 'StaticResourceDeleteError');
      }
    }

    ases.getAllSourceElements().forEach((ase) => {
      ase.getWorkspaceElements().some((we) => {
        const type = we.getMetadataName();
        const sourceMemberMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
          type,
          this.swa.metadataRegistry
        );
        const shouldDeleteWorkspaceAggregate = sourceMemberMetadataType.shouldDeleteWorkspaceAggregate(type);

        if (shouldDeleteWorkspaceAggregate) {
          ase.markForDelete();
          return true;
        } else {
          // the type is decomposed and we only want to delete components of an aggregate element
          const sourcepaths = sourcepath.split(',');
          if (sourcepaths.some((sp) => we.getSourcePath().includes(sp.trim()))) {
            we.setState(WorkspaceFileState.DELETED);
            ase.addPendingDeletedWorkspaceElement(we);
          }
        }
      });
      pendingDelPathsForPrompt = pendingDelPathsForPrompt.concat(
        ase.getPendingDeletedWorkspaceElements().map((el) => `${os.EOL}${el.getSourcePath()}`)
      );
    });

    if (noprompt || pendingDelPathsForPrompt.length === 0) {
      return true;
    }

    return this._handlePrompt(pendingDelPathsForPrompt);
  }

  private async _handlePrompt(pathsToPrompt: string[]): Promise<boolean> {
    // @todo this prompt should no be in the API. Need to remove.
    const messages = Messages.loadMessages('salesforce-alm', 'source_delete');
    // the pathsToPrompt looks like [ '\n/path/to/metadata', '\n/path/to/metadata/two']
    // move the \n from the front to in between each entry for proper output
    const paths = pathsToPrompt.map((p) => p.substr(2)).join('\n');
    const promptMessage = messages.getMessage('sourceDeletePrompt', [paths]);
    const answer: string = await cli.prompt(promptMessage);
    return answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y';
  }

  private async _processResults(result, aggregateSourceElements: AggregateSourceElements, deployDir: string) {
    if (result.success && result.details.componentFailures) {
      this.removeFailedAggregates(result.details.componentFailures, aggregateSourceElements);
    }

    // We need to check both success and status because a status of 'SucceededPartial' returns success === true even though rollbackOnError is set.
    if (result.success && result.status === 'Succeeded') {
      const isNonDestructiveChangeDelete =
        this.isDelete && !fsExtra.existsSync(`${deployDir}${path.sep}destructiveChangesPost.xml`);
      result.outboundFiles = this.getOutboundFiles(aggregateSourceElements, isNonDestructiveChangeDelete);
      return result;
    } else {
      // throw the error that is created by _setupDeployFail
      throw await this._setupDeployFail(result, aggregateSourceElements);
    }
  }

  private async _setupDeployFail(result, aggSourceElements: AggregateSourceElements) {
    const deployFailed: any = new Error();
    if (result.timedOut) {
      deployFailed.name = 'PollingTimeout';
    } else {
      deployFailed.name = 'DeployFailed';
      deployFailed.failures = syncCommandHelper.getDeployFailures(result, aggSourceElements, this.swa.metadataRegistry);
    }

    if (result.success && result.status === 'SucceededPartial') {
      deployFailed.outboundFiles = this.getOutboundFiles(aggSourceElements);
    }

    if (this.isDelete) {
      await this._revertDeletions(aggSourceElements);
      const messages = Messages.loadMessages('salesforce-alm', 'source_delete');
      deployFailed.message = messages.getMessage('sourceDeleteFailure');
    }

    return deployFailed;
  }

  // Revert all deletions since something went wrong and they were not deleted server side.
  // This copies all the files from the temporary location back to their original location.
  private async _revertDeletions(ases: AggregateSourceElements) {
    for (const ase of ases.getAllSourceElements()) {
      const parentDir = path.dirname(ase.getMetadataFilePath());
      try {
        await fs.access(parentDir, fs.constants.R_OK);
      } catch (e) {
        // If the parent directory does not exist, re-create it
        await fs.mkdirp(parentDir, fs.DEFAULT_USER_DIR_MODE);
      }

      // Re-create each workspace element
      for (const we of ase.getWorkspaceElements()) {
        const backupPath = path.join(this.tmpBackupDeletions, path.basename(we.getSourcePath()));
        fsExtra.copySync(backupPath, we.getSourcePath());
      }
    }
  }
}

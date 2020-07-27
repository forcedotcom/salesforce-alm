/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import cli from 'cli-ux';

// Node
import * as path from 'path';
import * as fsExtra from 'fs-extra';

// Local
import MetadataRegistry = require('./metadataRegistry');
import MdapiDeployApi = require('../mdapi/mdapiDeployApi');
import * as syncCommandHelper from './syncCommandHelper';
import * as sourceState from './sourceState';

import { Logger, SfdxError, Messages, fs } from '@salesforce/core';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { SourceDeployApiBase } from './sourceDeployApiBase';
import { WorkspaceElementObj } from './workspaceElement';
import { SourceOptions } from './types';
import * as SourceUtil from './sourceUtil';
import { AggregateSourceElement } from './aggregateSourceElement';
import { AggregateSourceElements } from './aggregateSourceElements';
import * as PathUtils from './sourcePathUtil';
import * as os from 'os';
import consts = require('../core/constants');
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { SourceElementsResolver } from './sourceElementsResolver';

export interface SourceDeployOptions extends SourceOptions {
  delete?: boolean;
  deploydir?: string;
  noprompt?: boolean;
  wait?: number;
  ignorewarnings?: boolean;
}

export interface DeployResult {
  outboundFiles: WorkspaceElementObj[];
  userCanceled?: boolean;
}

export class SourceDeployApi extends SourceDeployApiBase {
  private swa;
  private isDelete: boolean;
  private tmpBackupDeletions;
  private DELETE_NOT_SUPPORTED_IN_CONTENT = ['StaticResource'];
  static totalNumberOfPackages: number;
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

    const defaultPackagePath = this.orgApi.config.getAppConfig().defaultPackagePath;

    const swaOptions: SourceWorkspaceAdapter.Options = {
      org: this.orgApi,
      metadataRegistryImpl: MetadataRegistry,
      defaultPackagePath: defaultPackagePath,
      fromConvert: true,
      sourceMode: mode
    };
    this.swa = await SourceWorkspaceAdapter.create(swaOptions);
    SourceDeployApi.totalNumberOfPackages = this.swa.packageInfoCache.packageNames.length;

    let tmpOutputDir: string = await SourceUtil.createOutputDir('sourceDeploy');

    try {
      const sourceElementsResolver = new SourceElementsResolver(this.orgApi, this.swa);
      if (options.sourcepath) {
        this.logger.info(`Deploying metadata in sourcepath '${options.sourcepath}' from org: '${this.orgApi.name}'`);
        aggregateSourceElements = await SourceUtil.getSourceElementsFromSourcePath(options.sourcepath, this.swa);
      } else if (options.manifest) {
        this.logger.info(`Deploying metadata in manifest '${options.manifest}' from org: '${this.orgApi.name}'`);
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
          //if it is the metadata option, options.sourcepath was empty. Create a path to the "source" from the MD name
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

      if (!aggregateSourceElements.isEmpty()) {
        try {
          // Create a temp directory
          options.deploydir = tmpOutputDir;

          options.ignorewarnings = options.ignorewarnings || this.isDelete;
          if (!options.checkonly) {
            await this._doLocalDelete(aggregateSourceElements);
          }

          const result = await this.convertAndDeploy(options, this.swa, aggregateSourceElements, this.isDelete);

          // If we are only checking the metadata deploy, return what `mdapi:deploy` returns.
          // Otherwise process results and return similar to `source:push`
          if (options.checkonly || this.isAsync) {
            return result;
          } else {
            return await this._processResults(result, aggregateSourceElements, options.deploydir);
          }
        } finally {
          // Remove the sourcePathInfos.json file and delete any temp dirs
          this.orgApi.getSourcePathInfos().delete();
          await SourceUtil.cleanupOutputDir(this.tmpBackupDeletions);
        }
      } else {
        return { outboundFiles: [] };
      }
    } finally {
      await SourceUtil.cleanupOutputDir(tmpOutputDir);
    }
  }

  private async _doLocalDelete(ases: AggregateSourceElements) {
    this.tmpBackupDeletions = await SourceUtil.createOutputDir('sourceDelete');
    const cleanedCache = new Map<string, boolean>();
    ases.getAllSourceElements().forEach((ase: AggregateSourceElement) => {
      ase
        .getPendingDeletedWorkspaceElements()
        .forEach(we =>
          fsExtra.copySync(we.getSourcePath(), path.join(this.tmpBackupDeletions, path.basename(we.getSourcePath())))
        );
      ase.commitDeletes([]);
      const dirname = path.dirname(ase.getMetadataFilePath());
      if (!cleanedCache.get(dirname)) {
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

    /**delete of static resources file is not supported by cli */

    if (this.DELETE_NOT_SUPPORTED_IN_CONTENT.includes(metadataType)) {
      const data = fsExtra.statSync(sourcepath);
      if (data.isFile()) {
        throw SfdxError.create('salesforce-alm', 'source', 'StaticResourceDeleteError');
      }
    }

    ases.getAllSourceElements().forEach(ase => {
      ase.getWorkspaceElements().some(we => {
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
          if (sourcepaths.some(sp => we.getSourcePath().includes(sp.trim()))) {
            we.setState(sourceState.DELETED);
            ase.addPendingDeletedWorkspaceElement(we);
          }
        }
      });
      pendingDelPathsForPrompt = pendingDelPathsForPrompt.concat(
        ase.getPendingDeletedWorkspaceElements().map(el => `${os.EOL}${el.getSourcePath()}`)
      );
    });

    if (noprompt || pendingDelPathsForPrompt.length === 0) {
      return true;
    }

    return this._handlePrompt(pendingDelPathsForPrompt);
  }

  private async _handlePrompt(pathsToPrompt) {
    // @todo this prompt should no be in the API. Need to remove.
    const messages = Messages.loadMessages('salesforce-alm', 'source_delete');
    const promptMessage = messages.getMessage('sourceDeletePrompt', [pathsToPrompt]);
    const answer = await cli.prompt(promptMessage);
    return answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y';
  }

  private async _processResults(result, aggregateSourceElements: AggregateSourceElements, deployDir: string) {
    if (result.success && result.details.componentFailures) {
      this.removeFailedAggregates(result.details.componentFailures, aggregateSourceElements, this.swa.packageInfoCache);
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

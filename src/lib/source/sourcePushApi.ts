/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import MetadataRegistry = require('./metadataRegistry');
import Messages = require('../messages');
const messages = Messages();
import * as syncCommandHelper from './syncCommandHelper';
import logger = require('../core/logApi');

import { SourceDeployApiBase } from './sourceDeployApiBase';
import * as SourceUtil from './sourceUtil';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { AggregateSourceElements } from './aggregateSourceElements';
import { DeployResult } from './sourceDeployApi';
import { SrcStatusApi } from './srcStatusApi';
import { MaxRevision } from './MaxRevision';

interface DeployError extends Error {
  outboundFiles: object[];
  failures: object[];
}

interface PushOptions {
  deploydir?: string;
  wait?: number;
  forceoverwrite?: boolean;
}

export class MdapiPushApi extends SourceDeployApiBase {
  public swa: SourceWorkspaceAdapter;
  public scratchOrg: any;
  private metadataRegistry: MetadataRegistry;
  private maxRevision: MaxRevision;
  static totalNumberOfPackages: number;
  static packagesDeployed: number;

  protected async init(): Promise<void> {
    await super.init();
    this.metadataRegistry = new MetadataRegistry();
    const options: SourceWorkspaceAdapter.Options = {
      org: this.orgApi,
      metadataRegistryImpl: MetadataRegistry,
      defaultPackagePath: this.force.getConfig().getAppConfig().defaultPackagePath
    };

    this.swa = await SourceWorkspaceAdapter.create(options);
    await this.swa.backupSourcePathInfos();
    this.scratchOrg = options.org;
    this.maxRevision = await MaxRevision.getInstance({ username: this.scratchOrg.name });
  }

  async deployPackage(options: PushOptions, packageName: string): Promise<any> {
    try {
      this.logger.debug(`deploying package: ${packageName}`);

      const changedAggregateSourceElements = new AggregateSourceElements().set(
        packageName,
        this.swa.changedSourceElementsCache.get(packageName)
      );
      // Create a temp directory
      options.deploydir = options.deploydir || (await SourceUtil.createOutputDir('mdpkg'));
      if (!changedAggregateSourceElements.isEmpty()) {
        const result = await this.convertAndDeploy(options, this.swa, changedAggregateSourceElements, true);

        return await this.processResults(result, changedAggregateSourceElements, packageName);
      }
    } catch (err) {
      if (!err.outboundFiles) {
        await this.swa.revertSourcePathInfos();
      }
      throw err;
    } finally {
      await SourceUtil.cleanupOutputDir(options.deploydir);
    }
  }

  async doDeploy(options: PushOptions): Promise<DeployResult> {
    const results: DeployResult = { outboundFiles: [] };

    // Remove this when push has been modified to support the new mdapi wait functionality;
    if (isNaN(options.wait)) {
      options.wait = this.force.config.getConfigContent().defaultSrcWaitMinutes;
    }

    await this.checkForConflicts(options);

    MdapiPushApi.totalNumberOfPackages = this.swa.packageInfoCache.packageNames.length;
    MdapiPushApi.packagesDeployed = this.swa.changedSourceElementsCache.size;

    // Deploy metadata in each package directory
    let componentSuccessCount = 0;
    let flattenedDeploySuccesses = [];
    for (const pkg of this.swa.packageInfoCache.packageNames) {
      const sourceElements = this.swa.changedSourceElementsCache.get(pkg);
      if (sourceElements && sourceElements.size) {
        const opts = Object.assign({}, options);
        const deployResult = await this.deployPackage(opts, pkg);
        if (deployResult) {
          if (deployResult.numberComponentsDeployed) {
            componentSuccessCount += deployResult.numberComponentsDeployed;
          }
          if (deployResult.details && deployResult.details.componentSuccesses) {
            flattenedDeploySuccesses = [...flattenedDeploySuccesses, ...deployResult.details.componentSuccesses];
          }
          if (deployResult.outboundFiles && deployResult.outboundFiles.length) {
            results.outboundFiles = [...results.outboundFiles, ...deployResult.outboundFiles];
          }
        }
      }
    }

    // If more than 500 metadata components were pushed, display a message
    // that we're fetching the source tracking data, which happens asynchronously.
    if (componentSuccessCount > 500) {
      logger.log(`Updating source tracking for ${componentSuccessCount} pushed components...`);
    }

    // Calculate a polling timeout for SourceMembers based on the number
    // of deployed component successes plus a buffer of 5 seconds.
    const pollTimeoutSecs = Math.ceil(componentSuccessCount * 0.015) + 5;
    // post process after all deploys have been done to update source tracking.
    await this._postProcess(flattenedDeploySuccesses, pollTimeoutSecs);

    return results;
  }

  private async checkForConflicts(options: PushOptions) {
    if (options.forceoverwrite) {
      // do not check for conflicts when doing push --forceoverwrite
      return;
    } else {
      const statusApi = await SrcStatusApi.create({ org: this.orgApi, adapter: this.swa });
      let conflicts: any[] = [];
      try {
        await statusApi.doStatus({ local: true, remote: true });
        conflicts = statusApi.getLocalConflicts();
      } catch (err) {
        if (err.errorCode === 'INVALID_TYPE') {
          const error = new Error(messages.getMessage('NonScratchOrgPush'));
          error['name'] = 'NonScratchOrgPush';
          throw error;
        } else {
          throw err;
        }
      }
      if (conflicts.length > 0) {
        const error: any = new Error('Conflicts found during push');
        error['name'] = 'SourceConflict';
        error['sourceConflictElements'] = conflicts;
        throw error;
      }
    }
  }

  public commitChanges(packageName: string) {
    if (!!this.swa.pendingSourcePathInfos.get(packageName)) {
      return this.swa.commitPendingChanges(packageName);
    }
    return false;
  }

  private async processResults(result, changedAggregateSourceElements: AggregateSourceElements, packageName: string) {
    try {
      result = this._reinterpretResults(result);
      if (result.success && !!result.details.componentFailures) {
        this.removeFailedAggregates(
          result.details.componentFailures,
          changedAggregateSourceElements,
          this.swa.packageInfoCache
        );
      }

      // Update deleted items even if the deploy fails so the worksapce is consistent
      await this.swa.updateSource(changedAggregateSourceElements);
    } catch (e) {
      // Don't log to console
      this.logger.error(false, e);
    }

    // We need to check both success and status because a status of 'SucceededPartial' returns success === true even though rollbackOnError is set.
    if (result.success && result.status === 'Succeeded') {
      await this.commitChanges(packageName);
      result.outboundFiles = this.getOutboundFiles(changedAggregateSourceElements);
      return result;
    } else {
      let deployFailed = new Error() as DeployError;

      if (result.timedOut) {
        deployFailed.name = 'PollingTimeout';
      } else {
        deployFailed.name = 'DeployFailed';
        let aggregateSourceElements;

        try {
          // Try to get the source elements for better error messages, but still show
          // deploy failures if this errors out
          const packagePath = this.swa.packageInfoCache.getPackagePath(packageName);
          aggregateSourceElements = await this.swa.getAggregateSourceElements(false, packagePath);
        } catch (e) {
          // Don't log to console
          this.logger.error(false, e);
        }

        deployFailed.failures = syncCommandHelper.getDeployFailures(
          result,
          aggregateSourceElements,
          this.metadataRegistry,
          this.logger
        );
      }
      if (result.success && result.status === 'SucceededPartial') {
        await this.commitChanges(packageName);
        deployFailed.outboundFiles = this.getOutboundFiles(changedAggregateSourceElements);
      }
      throw deployFailed;
    }
  }

  async _postProcess(pushSuccesses: any[], pollTimeoutSecs: number) {
    const sourceMembers = await SourceUtil.getSourceMembersFromResult(pushSuccesses, this.maxRevision, pollTimeoutSecs);

    await this.maxRevision.setMaxRevisionCounterFromQuery();
    await this.maxRevision.updateSourceTracking(sourceMembers);
  }

  static _isDeleteFailureBecauseDoesNotExistOnServer(failure) {
    return (
      failure.fullName === 'destructiveChanges.xml' && syncCommandHelper.getFullNameFromDeleteFailure(failure) !== null
    );
  }

  static _isFailureToUs(failure) {
    return !MdapiPushApi._isDeleteFailureBecauseDoesNotExistOnServer(failure);
  }

  static _convertFailureToSuccess(failure) {
    /*
     * Delete of non existent entity error - that's ok for push.
     * Also note the weird fullName behavior in the mdapi deploy file property.
     * Fortunately we can recover the fullName from the error message text!
     */
    if (MdapiPushApi._isDeleteFailureBecauseDoesNotExistOnServer(failure)) {
      failure.fullName = syncCommandHelper.getFullNameFromDeleteFailure(failure);
      failure.deleted = 'true';
      failure.problem = null;
      failure.success = 'true';
    }
  }

  _recalculateResult(result, reinterpretedComponentSuccesses, reinterpretedComponentFailures) {
    result.details.componentSuccesses = SourceUtil.toArray(result.details.componentSuccesses);
    const originalSuccessCount = result.details.componentSuccesses.length - 1; // Ignore package.xml

    if (result.status === 'Failed') {
      // We can only convert a failed deploy to a success if all the failures can be ignored
      // *and* there were no successes reported for components that would have been deployed
      // if the deploy had succeeded, but actually failed on the server (which is not fixable here).
      result.status =
        reinterpretedComponentFailures.length === 0 && originalSuccessCount === 0 ? 'Succeeded' : 'Failed';
    } else {
      result.status = reinterpretedComponentFailures.length === 0 ? 'Succeeded' : result.status;
    }
    result.success = result.status !== 'Failed';

    if (result.success) {
      reinterpretedComponentSuccesses.forEach(failure => MdapiPushApi._convertFailureToSuccess(failure));

      result.details.componentSuccesses = result.details.componentSuccesses.concat(reinterpretedComponentSuccesses);
      result.details.componentFailures = reinterpretedComponentFailures;

      result.numberComponentsDeployed = result.details.componentSuccesses.length - 1; // Ignore package.xml
      result.numberComponentErrors = result.details.componentFailures.length;
      result.numberComponentsTotal = result.numberComponentsDeployed + result.numberComponentErrors;
    }
    return result;
  }

  /*
   * We'll take a look over the result to see if we want to change it to reflect the different
   * perspectives of mdapi deploy and push. We might consider some errors to be successes from
   * a push perspective. If we end up flipping some errors then we'll also need to recalculate
   * whether we are a success, partial success, or failure.
   */
  _reinterpretResults(result) {
    result.details.componentSuccesses = SourceUtil.toArray(result.details.componentSuccesses);
    if (result.status === 'Succeeded') {
      return result;
    }

    const componentFailures = SourceUtil.toArray(result.details.componentFailures);
    const reinterpretedComponentFailures = componentFailures.filter(failure => MdapiPushApi._isFailureToUs(failure));
    const reinterpretedComponentSuccesses = componentFailures.filter(failure => !MdapiPushApi._isFailureToUs(failure));
    if (reinterpretedComponentFailures.length !== componentFailures.length) {
      return this._recalculateResult(result, reinterpretedComponentSuccesses, reinterpretedComponentFailures);
    }
    return result;
  }
}

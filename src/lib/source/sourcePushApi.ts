/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// 3pp
import * as BBPromise from 'bluebird';

// Node
import * as util from 'util';

// Local
import MetadataRegistry = require('./metadataRegistry');
import Messages = require('../messages');
const messages = Messages();
import * as syncCommandHelper from './syncCommandHelper';
import logger = require('../core/logApi');

import { SourceDeployApiBase } from './sourceDeployApiBase';
import * as SourceUtil from './sourceUtil';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { DeployResult } from './sourceDeployApi';
import { SrcStatusApi } from './srcStatusApi';
import { RevisionCounterField } from './sourceUtil';

export class MdapiPushApi extends SourceDeployApiBase {
  public swa: SourceWorkspaceAdapter;
  public scratchOrg: any;
  private metadataRegistry: MetadataRegistry;

  protected async init(): Promise<void> {
    await super.init();
    this.metadataRegistry = new MetadataRegistry(this.orgApi);
    const options: SourceWorkspaceAdapter.Options = {
      org: this.orgApi,
      metadataRegistryImpl: MetadataRegistry,
      defaultPackagePath: this.force.getConfig().getAppConfig().defaultPackagePath
    };

    this.swa = await SourceWorkspaceAdapter.create(options);
    this.swa.backupSourcePathInfos();
    this.scratchOrg = options.org;
  }

  async doDeploy(options): Promise<DeployResult> {
    // Remove this when push has been modified to support the new mdapi wait functionality;
    if (isNaN(options.wait)) {
      options.wait = this.force.config.getConfigContent().defaultSrcWaitMinutes;
    }

    try {
      const changedAggregateSourceElements = await this.checkForConflicts(options);

      // Create a temp directory
      options.deploydir = options.deploydir || (await SourceUtil.createOutputDir('mdpkg'));

      if (changedAggregateSourceElements.size > 0) {
        const result = await this.convertAndDeploy(options, this.swa, changedAggregateSourceElements, true);
        return await this.processResults(result, changedAggregateSourceElements).then(result =>
          this._postProcess(result)
        );
      }
    } catch (err) {
      if (util.isNullOrUndefined(err.outboundFiles)) {
        this.swa.revertSourcePathInfos();
      }
      throw err;
    } finally {
      await SourceUtil.cleanupOutputDir(options.deploydir);
    }

    return { outboundFiles: [] };
  }

  private async checkForConflicts(options) {
    if (options.forceoverwrite) {
      // do not check for conflicts when doing push --forceoverwrite
      return this.swa.changedSourceElementsCache;
    } else {
      const statusApi = await SrcStatusApi.create({ org: this.orgApi, adapter: this.swa });
      return statusApi
        .doStatus({ local: true, remote: true })
        .then(() => statusApi.getLocalConflicts())
        .catch(err => {
          if (err.errorCode === 'INVALID_TYPE') {
            const error = new Error(messages.getMessage('NonScratchOrgPush'));
            error['name'] = 'NonScratchOrgPush';
            throw error;
          } else {
            throw err;
          }
        })
        .then(conflicts => {
          if (conflicts.length > 0) {
            const error: any = new Error('Conflicts found during push');
            error['name'] = 'SourceConflict';
            error['sourceConflictElements'] = conflicts;
            throw error;
          } else {
            return this.swa.changedSourceElementsCache; // if no conflicts return original elements to push
          }
        });
    }
  }

  public commitChanges() {
    if (!util.isNullOrUndefined(this.swa.pendingSourcePathInfos)) {
      return this.swa.commitPendingChanges();
    }
    return false;
  }

  private async processResults(result, changedAggregateSourceElements) {
    try {
      this._reinterpretResults(result);
      if (result.success && !util.isNullOrUndefined(result.details.componentFailures)) {
        this.removeFailedAggregates(result.details.componentFailures, changedAggregateSourceElements);
      }

      // Update deleted items even if the deploy fails so the worksapce is consistent
      this.swa.updateSource(changedAggregateSourceElements, undefined, undefined);
    } catch (e) {
      // Don't log to console
      this.logger.error(false, e);
    }

    // We need to check both success and status because a status of 'SucceededPartial' returns success === true even though rollbackOnError is set.
    if (result.success && result.status === 'Succeeded') {
      return BBPromise.resolve(this.commitChanges()).then(() => {
        result.outboundFiles = this.getOutboundFiles(changedAggregateSourceElements);
        return BBPromise.resolve(result);
      });
    } else {
      const deployFailed: any = new Error();
      if (result.timedOut) {
        deployFailed.name = 'PollingTimeout';
      } else {
        deployFailed.name = 'DeployFailed';
        let aggregateSourceElements;

        try {
          // Try to get the source elements for better error messages, but still show
          // deploy failures if this errors out
          aggregateSourceElements = this.swa.getAggregateSourceElements(false);
        } catch (e) {
          // Don't log to console
          this.logger.error(false, e);
        }

        deployFailed.failures = syncCommandHelper.getDeployFailures(
          result,
          aggregateSourceElements,
          this.metadataRegistry,
          logger
        );
      }
      if (result.success && result.status === 'SucceededPartial') {
        return BBPromise.resolve(this.commitChanges())
          .then(() => {
            deployFailed.outboundFiles = this.getOutboundFiles(changedAggregateSourceElements);
            return BBPromise.resolve(result);
          })
          .then(() => BBPromise.reject(deployFailed));
      } else {
        return BBPromise.reject(deployFailed);
      }
    }
  }

  async _postProcess(result) {
    const field = SourceUtil.getRevisionFieldName();
    if (field === RevisionCounterField.RevisionNum) {
      return result;
    } else {
      const members = [...new Set(result.outboundFiles.map(f => f.fullName))];
      await SourceUtil.updateMaxRevision(this.scratchOrg, this.metadataRegistry, members);
      return result;
    }
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
  }

  /*
   * We'll take a look over the result to see if we want to change it to reflect the different
   * perspectives of mdapi deploy and push. We might consider some errors to be successes from
   * a push perspective. If we end up flipping some errors then we'll also need to recalculate
   * whether we are a success, partial success, or failure.
   */
  _reinterpretResults(result) {
    if (result.status === 'Succeeded') {
      return;
    }

    const componentFailures = SourceUtil.toArray(result.details.componentFailures);
    const reinterpretedComponentFailures = componentFailures.filter(failure => MdapiPushApi._isFailureToUs(failure));
    const reinterpretedComponentSuccesses = componentFailures.filter(failure => !MdapiPushApi._isFailureToUs(failure));
    if (reinterpretedComponentFailures.length !== componentFailures.length) {
      this._recalculateResult(result, reinterpretedComponentSuccesses, reinterpretedComponentFailures);
    }
  }
}

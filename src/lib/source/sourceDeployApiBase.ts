/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as BBPromise from 'bluebird';
const replace = BBPromise.promisify(require('replace'));

import { AsyncCreatable } from '@salesforce/kit';
import { Lifecycle, Logger, SfdxProject } from '@salesforce/core';
import consts = require('../core/constants');
import StashApi = require('../core/stash');
import srcDevUtil = require('../core/srcDevUtil');
import MdapiDeployApi = require('../mdapi/mdapiDeployApi');
import MdapiPollIntervalStrategy = require('../mdapi/mdapiPollIntervalStrategy');
import { toArray } from './parseManifestEntriesArray';
import { WorkspaceFileState } from './workspaceFileState';
import SourceConvertApi = require('./sourceConvertApi');
import { DeployResult } from './sourceDeployApi';
import { AggregateSourceElements } from './aggregateSourceElements';
const { INSTANCE_URL_TOKEN } = consts;
const { sequentialExecute } = srcDevUtil;

export abstract class SourceDeployApiBase extends AsyncCreatable<SourceDeployApiBase.Options> {
  protected logger!: Logger;
  protected orgApi: any;
  protected force: any;
  protected isAsync: boolean;

  public constructor(options: SourceDeployApiBase.Options) {
    super(options);
    this.orgApi = options.org;
    this.force = options.org.force;
    this.isAsync = !!options.isAsync;
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
  }

  abstract doDeploy(options): Promise<DeployResult>;

  /**
   * Set additional required MDAPI options config and deploy
   *
   * @param options The flags on the context passed to the command.
   * @param {any} pollIntervalStrategy The strategy for how often to poll when doing a MD deploy
   * @returns {any}
   */
  mdapiDeploy(options: any, pollIntervalStrategy?: any) {
    // Default to disable mdapi logging.  Only when checkonly is explicitly true,
    // or testlevel is set, use the mdapi logging.
    options.disableLogging = !(options.checkonly === true || options.testlevel);
    options.autoUpdatePackage = false;
    options.testlevel = options.testlevel || 'NoTestRun';
    options.source = true;
    return new MdapiDeployApi(this.orgApi, pollIntervalStrategy, StashApi.Commands.SOURCE_DEPLOY).deploy(options);
  }

  /**
   * Set the state of the source elements that were deployed
   *
   * @param aggregateSourceElements The map of source elements to deploy
   * @returns {any}
   */
  getOutboundFiles(aggregateSourceElements: AggregateSourceElements, isDelete = false) {
    let deployedSourceElements = [];
    aggregateSourceElements.getAllSourceElements().forEach((aggregateSourceElement) => {
      deployedSourceElements = deployedSourceElements.concat(
        isDelete
          ? aggregateSourceElement.getWorkspaceElements().filter((el) => el.getState() === WorkspaceFileState.DELETED)
          : aggregateSourceElement.getWorkspaceElements()
      );
    });
    return deployedSourceElements.map((workspaceElement) => workspaceElement.toObject());
  }

  /**
   * Convert the SDFX-formatted source to MD-format and then deploy it to the org
   *
   * @param options The flags on the context passed to the command.
   * @param sourceWorkspaceAdapter
   * @param aggregateSourceElements The map of source elements to deploy
   * @param {boolean} createDestructiveChanges Whether destructiveChanges.xml needs to be created for this deployment
   * @returns {any}
   */
  async convertAndDeploy(
    options: any,
    sourceWorkspaceAdapter: any,
    aggregateSourceElements: AggregateSourceElements,
    createDestructiveChanges: boolean
  ) {
    const sourceConvertApi = new SourceConvertApi(this.orgApi, sourceWorkspaceAdapter);

    let result;
    try {
      const [sourceElementsToUpsert, deletedTypeNamePairs] = await sourceConvertApi.convertSourceToMdapi(
        options.deploydir,
        null,
        aggregateSourceElements,
        createDestructiveChanges,
        options.unsupportedMimeTypes,
        options.delete
      );

      // replace tokens embedded in source
      if (options.replacetokens) {
        await this.replaceTokens(options.deploydir);
      }

      let pollIntervalStrategy;
      // If checkonly or testlevel is set don't provide a poller or it will display
      // a status message from the mdapiDeploy logging on every poll.
      if (!(options.checkonly || options.testlevel || this.isAsync)) {
        pollIntervalStrategy = new MdapiPollIntervalStrategy(sourceElementsToUpsert, deletedTypeNamePairs);
      }
      result = await this.mdapiDeploy(options, pollIntervalStrategy);
      return result;
    } catch (err) {
      if (err.name === 'mdapiDeployFailed') {
        result = err.result;
        return result;
      }
      throw err;
    } finally {
      // Emit post deploy event upon success or failure.  If result is undefined
      // most likely there was an error during conversion.
      if (result) {
        Lifecycle.getInstance().emit('postdeploy', result);
      }
    }
  }

  /**
   * Remove source elements that failed to deploy
   *
   * @param componentFailures
   * @param aggregateSourceElements
   */
  removeFailedAggregates(componentFailures: any, deployedSourceElements: AggregateSourceElements) {
    let failedSourcePaths = [];
    const failures = toArray(componentFailures);
    failures.forEach((failure) => {
      const key = `${failure.componentType}__${failure.fullName}`;
      const packageName = SfdxProject.getInstance().getPackageNameFromPath(failure.fileName);
      const element = deployedSourceElements.getSourceElement(packageName, key);
      if (element) {
        element.getWorkspaceElements().forEach((element) => {
          failedSourcePaths = failedSourcePaths.concat(element.getSourcePath());
        });
        deployedSourceElements.deleteSourceElement(packageName, key);
      }
    });
  }

  /**
   * Some metadata types, such as RemoteSiteSetting, contain values specific to an org and need to be replaced
   * when the source is deployed to a new org
   *
   * @param dir The directory where the metadata resides
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async replaceTokens(dir: string) {
    const replaceConfigs = [
      {
        regex: INSTANCE_URL_TOKEN,
        replacement: this.orgApi.authConfig.instanceUrl,
        paths: [dir],
        recursive: true,
        includes: ['*.remoteSite-meta.xml'],
        silent: true,
      },
    ];

    const replaceFns = [];
    replaceConfigs.forEach((replaceConfig) => {
      replaceFns.push(
        () =>
          new BBPromise((resolve, reject) => {
            try {
              replace(replaceConfig);
              return resolve();
            } catch (err) {
              return reject(err);
            }
          })
      );
    });

    return sequentialExecute(replaceFns);
  }
}

// eslint-disable-next-line no-redeclare
export namespace SourceDeployApiBase {
  export interface Options {
    org: any;
    isAsync?: boolean;
  }
}

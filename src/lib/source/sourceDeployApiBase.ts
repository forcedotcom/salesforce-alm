/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as BBPromise from 'bluebird';
const replace = BBPromise.promisify(require('replace'));

import MdapiPollIntervalStrategy = require('../mdapi/mdapiPollIntervalStrategy');
import MdapiDeployApi = require('../mdapi/mdapiDeployApi');
import SourceConvertApi = require('./sourceConvertApi');
import srcDevUtil = require('../core/srcDevUtil');
import StashApi = require('../core/stash');
import * as sourceState from './sourceState';

import { toArray } from './sourceUtil';

import consts = require('../core/constants');
import { AsyncCreatable } from '@salesforce/kit';
import { Logger } from '@salesforce/core';
import { DeployResult } from './sourceDeployApi';
import { AggregateSourceElements } from './aggregateSourceElements';
import { PackageInfoCache } from './packageInfoCache';
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

  abstract async doDeploy(options): Promise<DeployResult>;

  /**
   * Set additional required MDAPI options config and deploy
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
   * @param aggregateSourceElements The map of source elements to deploy
   * @returns {any}
   */
  getOutboundFiles(aggregateSourceElements: AggregateSourceElements, isDelete: boolean = false) {
    let deployedSourceElements = [];
    aggregateSourceElements.getAllSourceElements().forEach(aggregateSourceElement => {
      deployedSourceElements = deployedSourceElements.concat(
        isDelete
          ? aggregateSourceElement.getWorkspaceElements().filter(el => el.getState() === sourceState.DELETED)
          : aggregateSourceElement.getWorkspaceElements()
      );
    });
    return deployedSourceElements.map(workspaceElement => workspaceElement.toObject());
  }

  /**
   * Convert the SDFX-formatted source to MD-format and then deploy it to the org
   * @param options The flags on the context passed to the command.
   * @param sourceWorkspaceAdapter
   * @param aggregateSourceElements The map of source elements to deploy
   * @param {boolean} createDestructiveChanges Whether destructiveChanges.xml needs to be created for this deployment
   * @returns {any}
   */
  convertAndDeploy(
    options: any,
    sourceWorkspaceAdapter: any,
    aggregateSourceElements: AggregateSourceElements,
    createDestructiveChanges: boolean
  ) {
    const sourceConvertApi = new SourceConvertApi(this.orgApi, sourceWorkspaceAdapter);

    return sourceConvertApi
      .convertSourceToMdapi(
        options.deploydir,
        null,
        aggregateSourceElements,
        createDestructiveChanges,
        options.unsupportedMimeTypes,
        options.delete
      )
      .then(([sourceElementsToUpsert, deletedTypeNamePairs]) => {
        // replace tokens embedded in source
        if (options.replacetokens) {
          return this.replaceTokens(options.deploydir).then(() => [sourceElementsToUpsert, deletedTypeNamePairs]);
        }

        return [sourceElementsToUpsert, deletedTypeNamePairs];
      })
      .then(([sourceElementsToUpsert, deletedTypeNamePairs]) => {
        let pollIntervalStrategy;
        // If checkonly or testlevel is set don't provide a poller or it will display
        // a status message from the mdapiDeploy logging on every poll.
        if (!(options.checkonly || options.testlevel || this.isAsync)) {
          pollIntervalStrategy = new MdapiPollIntervalStrategy(sourceElementsToUpsert, deletedTypeNamePairs);
        }
        return this.mdapiDeploy(options, pollIntervalStrategy);
      })
      .catch(err => {
        if (err.name === 'mdapiDeployFailed') {
          return err.result;
        }
        throw err;
      });
  }

  /**
   * Remove source elements that failed to deploy
   * @param componentFailures
   * @param aggregateSourceElements
   */
  removeFailedAggregates(
    componentFailures: any,
    deployedSourceElements: AggregateSourceElements,
    packageInfoCache: PackageInfoCache
  ) {
    let failedSourcePaths = [];
    const failures = toArray(componentFailures);
    failures.forEach(failure => {
      const key = `${failure.componentType}__${failure.fullName}`;
      const packageName = packageInfoCache.getPackageNameFromSourcePath(failure.fileName);
      const element = deployedSourceElements.getSourceElement(packageName, key);
      if (element) {
        element.getWorkspaceElements().forEach(element => {
          failedSourcePaths = failedSourcePaths.concat(element.getSourcePath());
        });
        deployedSourceElements.deleteSourceElement(packageName, key);
      }
    });
  }

  /**
   * Some metadata types, such as RemoteSiteSetting, contain values specific to an org and need to be replaced
   * when the source is deployed to a new org
   * @param dir The directory where the metadata resides
   */
  replaceTokens(dir: string) {
    const replaceConfigs = [
      {
        regex: INSTANCE_URL_TOKEN,
        replacement: this.orgApi.authConfig.instanceUrl,
        paths: [dir],
        recursive: true,
        includes: ['*.remoteSite-meta.xml'],
        silent: true
      }
    ];

    const replaceFns = [];
    replaceConfigs.forEach(replaceConfig => {
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

export namespace SourceDeployApiBase {
  export interface Options {
    org: any;
    isAsync?: boolean;
  }
}

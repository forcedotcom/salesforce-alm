/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as util from 'util';

import { Messages, SfdxError, SfdxErrorConfig, SfdxProject } from '@salesforce/core';
import { TelemetryGlobal } from '@salesforce/plugin-telemetry/lib/telemetryGlobal';
import srcDevUtil = require('../core/srcDevUtil');
import consts = require('../core/constants');
import logger = require('../core/logApi');
import * as almError from '../core/almError';
import { WorkspaceElementObj } from './workspaceElement';
import { SourceDeployApi, DeployResult } from './sourceDeployApi';
import { parseWaitParam, validateManifestPath } from './sourceUtil';

import { MdapiPushApi } from './sourcePushApi';
import * as syncCommandHelper from './syncCommandHelper';
import { SourceDeployApiBase } from './sourceDeployApiBase';

declare const global: TelemetryGlobal;

Messages.importMessagesDirectory(__dirname);

// One of these flags must be specified for a valid deploy.
const requiredFlags = ['manifest', 'metadata', 'sourcepath', 'validateddeployrequestid'];

export class SourceApiCommand {
  static readonly SOURCE_DEPLOY: string = 'deploy';
  static readonly SOURCE_PUSH: string = 'push';

  private orgApi;
  private verbose;
  private json;
  private checkonly: boolean;
  private isQuickDeploy: boolean;
  private isAsync: boolean;
  private logger;
  private deploytype;
  private pushMsgs;
  private deployMsgs;
  private commonMsgs;
  private userCanceled: boolean;
  private metadataTypeDeployed: string[] = [];

  constructor(private readonly isSourceDelete: boolean) {
    this.logger = logger.child(`source:${this.deploytype}`);
    this.pushMsgs = Messages.loadMessages('salesforce-alm', 'source_push');
    this.deployMsgs = Messages.loadMessages('salesforce-alm', 'source_deploy');
    this.commonMsgs = Messages.loadMessages('salesforce-alm', 'source');
  }

  getPreExecuteMessage({ orgId, username }) {
    return this.commonMsgs.getMessage(`${this.deploytype}CommandCliPreExecute`, [orgId, username]);
  }

  /**
   * Executes the source deploy or push command
   *
   * @param context - the cli context
   * @returns {Promise}
   */
  public async execute(context: any): Promise<any> {
    const rows = [];
    const projectPath = this.orgApi.config.getProjectPath();
    let results: DeployResult;
    const options = { org: this.orgApi };
    const deployApi: SourceDeployApiBase = this.isDeploy()
      ? await SourceDeployApi.create(options)
      : await MdapiPushApi.create(options);
    return Promise.resolve()
      .then(() => {
        context.unsupportedMimeTypes = []; // for logging unsupported static resource mime types
        context.delete = this.isSourceDelete; // SourceDeployApi is for source:deploy and MdapiPushApi is for source:push
        return deployApi.doDeploy(context);
      })
      .catch((e) => {
        if (e.name === 'SourceConflict') {
          const error = almError('sourceConflictDetected');
          e.sourceConflictElements.forEach((sourceElement) =>
            syncCommandHelper.createConflictRows(rows, sourceElement, projectPath)
          );
          error['columns'] = syncCommandHelper.getColumnMetaInfo(this.commonMsgs);
          error['result'] = rows;
          this.logger.error(this.pushMsgs.getMessage('pushCommandConflictMsg'));
          throw error;
        } else if (e.name === 'DeployFailed') {
          e.failures.forEach((failure) => syncCommandHelper.createDeployFailureRow(rows, failure, projectPath));
          const messageBundle = this.deploytype === 'deploy' ? this.deployMsgs : this.pushMsgs;

          const actions = SfdxProject.getInstance().hasMultiplePackages()
            ? ['Check the order of your dependencies and ensure all metadata is included.']
            : [];

          const error = new SfdxError(
            messageBundle.getMessage(`source${this.deploytype}Failed`),
            'DeployFailed',
            actions
          );
          if (!util.isNullOrUndefined(e.outboundFiles)) {
            const successes = [];
            e.outboundFiles.forEach((sourceElement) =>
              syncCommandHelper.createDisplayRows(successes, sourceElement, projectPath)
            );
            error['partialSuccess'] = successes.length > 0 ? successes : undefined;
          }
          error['columns'] = this._getErrorColumnData();
          error.setData(rows);
          if (e.message) {
            error['message'] = e.message;
            this.logger.error(error.message);
          }
          throw error;
        } else if (e.name === 'PollingTimeout') {
          const errConfig = new SfdxErrorConfig('salesforce-alm', 'source', 'DeployTimeout');
          errConfig.setErrorTokens([this.deploytype, context.wait]);
          throw SfdxError.create(errConfig);
        } else {
          throw e;
        }
      })
      .then((deployResult: DeployResult) => {
        // checkonly and validateddeployrequestid flags display mdapi:deploy output
        if (this.checkonly || this.isQuickDeploy || this.isAsync) {
          results = deployResult;
          return;
        }

        if (deployResult.userCanceled) {
          // user canceled the delete by selecting 'n' when prompted.
          this.userCanceled = deployResult.userCanceled;
        } else {
          deployResult.outboundFiles.forEach((sourceElement: WorkspaceElementObj) => {
            if (!this.metadataTypeDeployed.includes(sourceElement.type)) {
              this.metadataTypeDeployed.push(sourceElement.type);
            }
            syncCommandHelper.createDisplayRows(rows, sourceElement, projectPath);
          });
        }
      })
      .then(() => {
        this.createEvent();
        if (this.isAsync) {
          SourceApiCommand.prototype['getHumanSuccessMessage'] = this.getHumanSuccessMessageDelegate;
        }

        // checkonly and validateddeployrequestid flags display mdapi:deploy output
        if (!(this.userCanceled || this.checkonly || this.isQuickDeploy || this.isAsync)) {
          // User elected to continue the deleted so we can display the proper tabular output.
          const tableHeaderKey = this.isSourceDelete
            ? 'deleteCommandHumanSuccess'
            : `${this.deploytype}CommandHumanSuccess`;
          const tableHeader = this.commonMsgs.getMessage(tableHeaderKey);
          this.logger.styledHeader(this.logger.color.blue(tableHeader));
          SourceApiCommand.prototype['getColumnData'] = this._getColumnData;
        }
      })
      .then(() => srcDevUtil.logUnsupportedMimeTypeError(context.unsupportedMimeTypes, this.logger, this.orgApi.force))
      .then(() => {
        // checkonly and validateddeployrequestid flags display mdapi:deploy output
        if (this.checkonly || this.isQuickDeploy || this.isAsync) {
          return results;
        }

        if (this.userCanceled) {
          return {};
        }
        if (context.json) {
          if (this.isDeploy()) {
            return this.isSourceDelete ? { deletedSource: rows } : { deployedSource: rows };
          }
          return { pushedSource: rows };
        }
        return rows;
      });
  }
  private getHumanSuccessMessageDelegate(obj: any) {
    if (obj.status && obj.id) {
      this.logger.styledHeader(this.logger.color.yellow('Status')); // Change the color based on state?
      this.logger.log(`Status: ${obj.status}`);
      this.logger.log(`Id: ${obj.id}${os.EOL}`);
      this.logger.log(`Run sfdx force:source:deploy:cancel -i ${obj.id} to cancel the deploy.`);
      this.logger.log(`Run sfdx force:source:deploy:report -i ${obj.id} to get the latest status.`);
    } else {
      // do something
    }
  }
  /**
   * Validates the source push or deploy command parameters
   *
   * @param context - the cli context
   * @returns {Promise}
   */
  public async validate(context: any): Promise<any> {
    this.orgApi = context.org;
    this.verbose = context.flags.verbose;
    this.json = context.flags.json;
    this.deploytype = context.deploytype;
    this.checkonly = context.flags.checkonly;
    this.isQuickDeploy = context.flags.validateddeployrequestid;
    this.isAsync = this.isDeploy() && context.flags.wait === `${consts.MIN_SRC_DEPLOY_WAIT_MINUTES}`;

    const fixedContext = srcDevUtil.fixCliContext(context);

    // Validate the wait param if set and convert to an integer.
    if (this.isAsync) {
      parseWaitParam(fixedContext, consts.MIN_SRC_DEPLOY_WAIT_MINUTES);
    } else {
      parseWaitParam(fixedContext);
    }

    if (this.isDeploy()) {
      // verify that the user defined one of: manifest, metadata, sourcepath, validateddeployrequestid
      if (!Object.keys(context.flags).some((flag) => requiredFlags.includes(flag))) {
        throw SfdxError.create('salesforce-alm', 'source', 'MissingRequiredParam', requiredFlags);
      }

      // verify that the manifest file exists and is readable.
      if (fixedContext.manifest) {
        await validateManifestPath(fixedContext.manifest);
      }
    }

    return Promise.resolve(fixedContext);
  }

  private isDeploy() {
    return this.deploytype === SourceApiCommand.SOURCE_DEPLOY;
  }

  /**
   * This indicates to index.js that this command should produce tabular output.
   *
   * @returns {*[]}
   */
  _getColumnData() {
    return syncCommandHelper.getColumnMetaInfo(this.commonMsgs, this.isDeploy());
  }

  getHumanErrorMessage(error) {
    if (!error.partialSuccess) {
      return; // Don't get in the way of single table normal errors
    }

    let needNewLine = false;
    if (error.partialSuccess && error.partialSuccess.length > 0) {
      const headerSuccess = this.commonMsgs.getMessage(`${this.deploytype}CommandHumanSuccess`);
      const columnsSuccess = syncCommandHelper.getColumnMetaInfo(this.commonMsgs);
      this.logger.styledHeader(this.logger.color.blue(headerSuccess));
      this.logger.table(error.partialSuccess, { columns: columnsSuccess });
      needNewLine = true;
    }

    if (error.data && error.data.length > 0) {
      if (needNewLine) {
        this.logger.log(os.EOL);
      }
      const headerErrors = this.commonMsgs.getMessage(`${this.deploytype}CommandHumanError`);
      this.logger.styledHeader(this.logger.color.red(headerErrors));
    }

    return;
  }

  _getErrorColumnData() {
    if (this.verbose || this.json) {
      return [
        {
          key: 'fullName',
          label: this.commonMsgs.getMessage('fullNameTableColumn'),
        },
        { key: 'type', label: this.commonMsgs.getMessage('typeTableColumn') },
        {
          key: 'filePath',
          label: this.commonMsgs.getMessage('workspacePathTableColumn'),
        },
        { key: 'error', label: this.commonMsgs.getMessage('errorColumn') },
        {
          key: 'lineNumber',
          label: this.commonMsgs.getMessage('lineNumberColumn'),
        },
        {
          key: 'columnNumber',
          label: this.commonMsgs.getMessage('columnNumberColumn'),
        },
      ];
    } else {
      return [
        {
          key: 'problemType',
          label: this.commonMsgs.getMessage('typeTableColumn'),
        },
        {
          key: 'filePath',
          label: this.commonMsgs.getMessage('workspacePathTableColumn'),
        },
        {
          key: 'error',
          label: this.commonMsgs.getMessage('errorColumn'),
        },
      ];
    }
  }

  createEvent() {
    let listOfMetadataTypesDeployed = this.metadataTypeDeployed.toString();
    const operation: string = this.isDeploy() ? 'source:deploy' : 'source:push';
    const totalNumberOfPackagesInProject: number = SfdxProject.getInstance().getUniquePackageDirectories().length;
    const packagesDeployed = this.isDeploy() ? SourceDeployApi.packagesDeployed : MdapiPushApi.packagesDeployed;
    const istruncated: boolean = listOfMetadataTypesDeployed.length < 8000 ? false : true;
    if (istruncated) {
      listOfMetadataTypesDeployed = listOfMetadataTypesDeployed
        .slice(0, 7975)
        .toString()
        .concat('..metadataTypes truncated');
    }

    if (global.cliTelemetry && global.cliTelemetry.record) {
      global.cliTelemetry.record({
        eventName: 'SOURCE_OPERATION',
        operation,
        type: 'EVENT',
        totalNumberOfPackages: totalNumberOfPackagesInProject,
        numberOfPackagesDeployed: packagesDeployed,
        componentsDeployed: listOfMetadataTypesDeployed,
        componentsDeployedTruncated: istruncated,
      });
    }
  }
}

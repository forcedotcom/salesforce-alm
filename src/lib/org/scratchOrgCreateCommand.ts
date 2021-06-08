/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { promisify } from 'util';
import { fs } from '@salesforce/core';
import * as _ from 'lodash';

// Local
import { Org as CoreOrg, StreamingClient, PollingClient, StatusResult, SfdxError, Lifecycle } from '@salesforce/core';
import { JsonMap, ensureString, asJsonMap, getString } from '@salesforce/ts-types';
import { Duration } from '@salesforce/kit';
import VarargsCommand from '../core/varargsCommand';
import Org = require('../core/scratchOrgApi');
import Alias = require('../core/alias');
import * as almError from '../core/almError';
import * as ScratchOrgInfoApi from './scratchOrgInfoApi';

import * as envTypes from './envTypes';
// eslint-disable-next-line @typescript-eslint/no-misused-promises
const fs_readFile = promisify(fs.readFile);
import Messages = require('../messages');
const messages = Messages();
import srcDevUtil = require('../core/srcDevUtil');
import consts = require('../core/constants');
import * as scratchOrgInfoGenerator from './scratchOrgInfoGenerator';
import logApi = require('../core/logApi');
import * as Url from 'url';

import { ScratchOrgFeatureDeprecation } from './scratchOrgFeatureDeprecation';
import { OrgCreateResult } from './orgHooks';
import { RemoteSourceTrackingService } from '../source/remoteSourceTrackingService';

const _ENV_TYPES = envTypes;

const _DEFAULT_ENV_TYPE = '';
const TOPIC = '/event/OrgLifecycleNotification';

const _getClientSecretError = function () {
  const error = new Error(messages.getMessage('ClientSecretRequired'));
  error['name'] = 'ClientSecretRequired';
  return error;
};

// eslint-disable-next-line @typescript-eslint/require-await
const _getClientSecret = async function (stdinValues, org) {
  if (!_.isNil(stdinValues)) {
    // If the user provided anything via stdin, it has to be a non-null, non-whitespace secret.
    const clientSecret = stdinValues.get('secret');
    if (_.isNil(clientSecret) || _.isNil(clientSecret.trim())) {
      throw _getClientSecretError();
    }
    return clientSecret.trim();
  } else {
    // The user didn't provide a secret, so get it from the Hub config, if it exists.
    return org
      .getConfig()
      .then((hubOrgConfig) => {
        const hubOrgConfigKey = hubOrgConfig.clientId;
        let hubOrgClientSecret = hubOrgConfig.clientSecret;
        if (hubOrgConfigKey != null) {
          hubOrgClientSecret = hubOrgClientSecret && hubOrgClientSecret.trim();
          return hubOrgClientSecret;
        } else if (_.isNil(hubOrgConfig.privateKey)) {
          // The clientSecret and privateKey are both missing, using an access token so use the default connected app
          if (org.usingAccessToken) {
            // Return null because we don't know what connected app was used to get that access token.
            return null;
          }
          return Promise.reject(_getClientSecretError());
        } else {
          // JWT OAuth flow. There'd better be a privateKey in the Hub, or else
          // we're going to have no way to authenticate into the resulting org.
          return null;
        }
      })
      .catch((err) => Promise.reject(err));
  }
};

// A validator function to ensure any options parameters entered by the user adhere
// to a allowlist of valid option settings. Because org:create allows options to be
// input either key=value pairs or within the definition file, this validator is
// executed within the ctor and also after parsing/normalization of the definition file.
const optionsValidator = (key, value, scratchOrgInfoPayload) => {
  if (key.toLowerCase() === 'durationdays') {
    throw almError('unrecognizedScratchOrgOption', 'durationDays');
  }

  if (key.toLowerCase() === 'snapshot') {
    const foundInvalidFields = [];
    OrgCreateCommand.SNAPSHOT_UNSUPPORTED_OPTIONS.forEach((invalidField) => {
      if (scratchOrgInfoPayload.hasOwnProperty(invalidField)) {
        foundInvalidFields.push(invalidField);
      }
    });

    if (foundInvalidFields.length > 0) {
      const msg = messages.getMessage(
        'unsupportedSnapshotOrgCreateOptions',
        [foundInvalidFields.join(', ')],
        'orgSnapshot'
      );
      throw new Error(msg);
    }
  }
};

/**
 * constructs a create command helper
 *
 * @param force - the force api
 * @constructor
 */
class OrgCreateCommand extends VarargsCommand {
  public static readonly SNAPSHOT_UNSUPPORTED_OPTIONS = [
    'features',
    'orgPreferences',
    'edition',
    'sourceOrg',
    'settingsPath',
    'releaseVersion',
    'language',
  ];

  public static DEFAULT_POLLING_FREQ = Duration.seconds(30);

  private workspaceType: string;
  private force: any;
  private org: Org;
  private scratchOrgInfoId: string;
  private cliContext: any;

  constructor() {
    super('org:create', [optionsValidator]);
    this.workspaceType = _DEFAULT_ENV_TYPE;
  }

  /**
   * secondary validation from the cli interface. this is a protocol style function intended to be represented by other
   * commands
   *
   * @param context - this cli context
   * @returns {Promise}
   */
  async validate(context): Promise<any> {
    // validate varargs
    await super.validate(context);
    this.org = context.org;
    this.force = this.org.force;
    this.cliContext = context;
    const fixedContext = srcDevUtil.fixCliContext(context);

    // Ensure we have an org config input source.
    if (!fixedContext.definitionjson && !fixedContext.definitionfile && !_.get(context, 'args.length')) {
      const message = messages.getMessage('cliForceCreateNoConfig');
      return Promise.reject(new Error(message));
    }

    if (!_.isNil(fixedContext.env) && !Object.hasOwnProperty.call(_ENV_TYPES, fixedContext.env)) {
      const envError = new Error(messages.getMessage('unsupportedValueForEnv', fixedContext.env));
      envError.name = 'UnsupportedValueForCreateEnv';
      return Promise.reject(envError);
    }

    if (!_.isNil(fixedContext.durationdays)) {
      const durationNum = parseFloat(fixedContext.durationdays);
      if (!_.isInteger(durationNum) || !_.inRange(durationNum, 1, 31)) {
        throw almError('unsupportedValueForDuration', fixedContext.durationdays);
      }
    }
    return this.org
      .getConfig()
      .then((config) => {
        // If the env flag is not specified and the url is not an internal salesforce url.
        if (_.isNil(fixedContext.env) && !srcDevUtil.isInternalUrl(config.instanceUrl)) {
          fixedContext.env = _ENV_TYPES.sandbox;
        }

        this.workspaceType = fixedContext.env || this.workspaceType;

        return fixedContext;
      })
      .catch((e) => {
        if (e.name === 'InvalidProjectWorkspace' && !fixedContext.targetdevhubusername) {
          e.name = 'NoWorkspaceOrUser';
          e.message = messages.getMessage('NoWorkspaceOrUser');
        }
        throw e;
      });
  }

  streamProcessor(message: JsonMap): StatusResult {
    const lifecycleRequestId = _.get(message, 'payload.LifecycleRequestId');
    const status = _.get(message, 'payload.Status');
    if (lifecycleRequestId && lifecycleRequestId === this.scratchOrgInfoId) {
      if (status === 'Active') {
        return {
          payload: lifecycleRequestId,
          completed: true,
        };
      } else if (status === 'Error') {
        const errorMessage = messages.getMessage(
          'signupFailed',
          getString(message, 'message.payload.ErrorCode') ||
            getString(message, 'message.payload.StatusCode') ||
            'unknown'
        );

        const error = new Error(errorMessage);
        error['name'] = 'ScratchOrgInfoError';
        throw error;
      }
    }

    return { completed: false };
  }

  /**
   * This performs three functions.
   * 1) Setup a stream listener for a OrgLifecycleNotification
   * 2) Prepares the cli input for the scratchOrgInfo request
   * 3) Calls the server to create a scratchOrgInfo
   *
   * @returns {Promise}
   * @private
   */
  private async signupOrgWithStreaming(scratchOrgInfoApi, cliContext): Promise<string> {
    const appLogger = await this.getLogger();
    const scratchOrgInfo = await this._getScratchOrgInfo(this.org, cliContext);
    const coreOrg = await CoreOrg.create({ aliasOrUsername: this.org.name });
    // Set the API version on the org connection so the streaming client uses the correct version.
    coreOrg.getConnection().setApiVersion(this.force.config.getApiVersion());

    const options = new StreamingClient.DefaultOptions(coreOrg, TOPIC, this.streamProcessor.bind(this));

    if (cliContext.wait) {
      options.setSubscribeTimeout(Duration.minutes(cliContext.wait));
    } else {
      options.setSubscribeTimeout(Duration.minutes(consts.DEFAULT_STREAM_TIMEOUT_MINUTES));
    }

    if (scratchOrgInfo.snapshot && !cliContext.wait) {
      // snapshot creates may take longer than regular as snapshots are not pooled
      // TODO: (a) figure out pooling for snapshots and (b) move org:create to async and
      // develop post-create command to finalize org setup (org preferences, eg)
      const defaultTimeout: Duration = options.subscribeTimeout;
      options.setSubscribeTimeout(Duration.milliseconds(defaultTimeout.milliseconds * 2));
    }

    try {
      const asyncStatusClient: StreamingClient = await StreamingClient.create(options);

      appLogger.debug('Attempting StreamingClient handshake');
      await asyncStatusClient.handshake();
      appLogger.debug('Finished StreamingClient handshake');

      return ensureString(
        await asyncStatusClient.subscribe(async () => {
          appLogger.debug('Subscribing to StreamingClient events');
          appLogger.debug('Requesting Org Signup');
          const requestResponse = await scratchOrgInfoApi.request(scratchOrgInfo);
          this.scratchOrgInfoId = requestResponse.id;
          appLogger.debug(`Org Signup completed with id: ${this.scratchOrgInfoId}`);
        })
      );
    } catch (e) {
      appLogger.debug(`There was an error thrown attempting to signup the org. Error: ${e.message}`);
      if (this.scratchOrgInfoId) {
        // If any error occurs and we happen to already have a scratchOrgId lets query one more time
        // for the org status. Just in case the streaming world wasn't helpful.
        try {
          appLogger.debug(`Despite the error there is a scratchOrgInfoId: ${this.scratchOrgInfoId}.`);
          appLogger.debug('Attempting the determine the signup status one more time.');
          const orgInfo = await scratchOrgInfoApi.retrieveScratchOrgInfo(this.scratchOrgInfoId);
          if (orgInfo) {
            appLogger.debug(`The status of the org: ${orgInfo.Status}`);
            if (orgInfo.Status === 'Active') {
              return this.scratchOrgInfoId;
            }
          }
        } catch (retrieveError) {
          // If we get any errors from the secondary query throw the outer error and log the inner error.
          if (retrieveError.name === 'RemoteOrgSignupFailed') {
            throw retrieveError;
          } else {
            // This will likely never happen. Unknown signup status....
            appLogger.debug(retrieveError);
            throw e;
          }
        }
      }
      throw e;
    }
  }

  private async signupOrgWithPolling(scratchOrgInfoApi: Org, cliContext: any, useCliWait: boolean): Promise<string> {
    const appLogger = await this.getLogger();
    appLogger.debug('Streaming failed. Polling for signup statues.');
    const options: PollingClient.Options = new PollingClient.DefaultPollingOptions(
      async (): Promise<StatusResult> => {
        if (this.scratchOrgInfoId) {
          appLogger.debug(`polling client this.org.name: ${this.org.name}`);
          let result;
          try {
            result = await scratchOrgInfoApi.retrieveScratchOrgInfo(this.scratchOrgInfoId);
          } catch (e) {
            if (e.name === 'UnexpectedSignupStatus') {
              appLogger.debug("Unexpected signup status encountered. Let's keep trying..");
              return { completed: false };
            } else {
              appLogger.debug('Signup response contained an error. Re-throwing');
              throw e;
            }
          }
          appLogger.debug(`polling client result: ${JSON.stringify(result, null, 4)}`);
          if (result.Status === 'Active') {
            return {
              completed: true,
              payload: {
                Status: result.Status,
                Id: this.scratchOrgInfoId,
              },
            };
          }
        }
        return { completed: false };
      }
    );
    options.timeoutErrorName = 'ScratchOrgCreatePollingTimout';
    if (useCliWait) {
      options.timeout = Duration.minutes(parseInt(cliContext.wait));
    }
    options.frequency = OrgCreateCommand.DEFAULT_POLLING_FREQ;
    appLogger.debug(`PollingTimeout in minutes: ${options.timeout.minutes}`);
    const client = await PollingClient.create(options);
    const scratchOrgInfo = await this._getScratchOrgInfo(this.org, cliContext);
    // If for some reason there isn't a scratch org id that means the signup request failed. It's safe to try and
    // create a new signup request.
    appLogger.debug(`signupOrgWithPolling this.scratchOrgInfoId: ${this.scratchOrgInfoId}`);
    if (!this.scratchOrgInfoId) {
      const scratchOrgInfoRequestResult = await scratchOrgInfoApi.request(scratchOrgInfo);
      this.scratchOrgInfoId = scratchOrgInfoRequestResult.id;
    }
    const result = asJsonMap(await client.subscribe());
    return ensureString(result.Id);
  }

  /**
   * executes the command. this is a protocol style function intended to be represented by other commands.
   *
   * @param cliContext - the cli context
   * @param stdinValues - param values obtained from stdin
   * @returns {Promise}
   */
  async execute(cliContext, stdinValues): Promise<any> {
    const appLogger = await this.getLogger();
    const scratchOrgInfoApi = new ScratchOrgInfoApi(this.force, this.org);
    const scratchOrgApi = new Org(this.force);

    let scratchOrgInfoId: string;
    try {
      scratchOrgInfoId = await this.signupOrgWithStreaming(scratchOrgInfoApi, cliContext);
      appLogger.debug('Streaming for signup events complete');
    } catch (e) {
      appLogger.debug(
        `An error was encountered during streaming; code: ${e.code} message: ${e.message} name: ${e.name}`
      );
      // Some cloud platforms and Salesforce streaming may have problems communicating. If this happens we will
      // default to polling.
      if (e.code == '403' && e.message && e.message.includes('Unknown client')) {
        scratchOrgInfoId = await this.signupOrgWithPolling(scratchOrgInfoApi, cliContext, true);
      } else if (e.name) {
        /**
         * If the streaming client times out doing a handshake then we will default to polling
         * only if the the config option is enabled.
         */
        if (e.name === StreamingClient.TimeoutErrorType.HANDSHAKE) {
          scratchOrgInfoId = await this.signupOrgWithPolling(scratchOrgInfoApi, cliContext, true);
        } else if (e.name === StreamingClient.TimeoutErrorType.SUBSCRIBE) {
          // This happens if the stream listener is aborted.
          // We will report back to the user, understanding there is no auth stored for this org because of the
          // timeout. Without a password or token this org is basically in an abandoned state.

          if (this.scratchOrgInfoId) {
            throw almError('genericTimeoutMessage', [], 'genericTimeoutCommandWaitMessageAction', [
              `sfdx force:data:soql:query -q "SELECT Status FROM ScratchOrgInfo WHERE Id='${this.scratchOrgInfoId}'"`,
            ]);
          } else {
            throw almError('genericTimeoutMessage', [], 'genericTimeoutWaitMessageAction');
          }
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }

    const scratchOrgInfoResult = await scratchOrgInfoApi.retrieveScratchOrgInfo(scratchOrgInfoId);
    appLogger.debug(`retrieveScratchOrgInfo: ${scratchOrgInfoResult.Status}`);
    const clientSecret = await _getClientSecret(stdinValues, this.org);
    scratchOrgApi.alias = cliContext.setalias;
    const orgData = await scratchOrgInfoApi.processScratchOrgInfoResult(
      scratchOrgInfoResult,
      clientSecret,
      scratchOrgApi,
      !!cliContext.setdefaultusername
    );

    if (cliContext.setalias) {
      await Alias.set(cliContext.setalias, scratchOrgApi.getName());
    }

    /** updating the revision num to zero during org:creation if source members are created during org:create.This only happens for some specific scratch org definition file.*/
    await this.updateRevisionCounterToZero(scratchOrgApi, orgData);
    // initialize the maxRevision.json file.
    try {
      await RemoteSourceTrackingService.getInstance({ username: scratchOrgApi.getName() });
    } catch (err) {
      // Do nothing. If org:create is not executed within sfdx project, allow the org to be created without errors.
      appLogger.debug(`Failed to create the maxRevision.json file due to the error : ${err.message}`);
    }

    // emit postorgcreate event for hook
    const postOrgCreateHookInfo: OrgCreateResult = [orgData].map((element) => ({
      accessToken: element.accessToken,
      clientId: element.clientId,
      created: element.created,
      createdOrgInstance: element.createdOrgInstance,
      devHubUsername: element.devHubUsername,
      expirationDate: element.expirationDate,
      instanceUrl: element.instanceUrl,
      loginUrl: element.loginUrl,
      orgId: element.orgId,
      username: element.username,
    }))[0];
    await Lifecycle.getInstance().emit('postorgcreate', postOrgCreateHookInfo);

    return { orgId: orgData.orgId, username: scratchOrgApi.getName() };
  }

  // Returns a valid signup json object
  async _getScratchOrgInfo(masterOrg, context): Promise<any> {
    // Varargs input overrides definitionjson (-j option; hidden/deprecated)
    const definitionJson = context.definitionjson ? JSON.parse(context.definitionjson) : {};
    const orgConfigInput = Object.assign(definitionJson, this.keyValuePairs || {});

    let scratchOrgInfoPayload = orgConfigInput;

    // the -f option
    if (context.definitionfile) {
      try {
        const defFileContents = await fs_readFile(context.definitionfile);
        // definitionjson and varargs override file input
        scratchOrgInfoPayload = Object.assign(
          {},
          JSON.parse(defFileContents ? defFileContents.toString() : ''),
          orgConfigInput
        );
      } catch (err) {
        const thrownErr = srcDevUtil.processReadAndParseJsonFileError(err, context.definitionfile);
        throw thrownErr;
      }
    }

    // scratchOrgInfoPayload must be heads down camelcase.
    const upperCaseKey = srcDevUtil.findUpperCaseKeys(scratchOrgInfoPayload);
    if (upperCaseKey) {
      throw almError('InvalidJsonCasing', [upperCaseKey, JSON.stringify(scratchOrgInfoPayload, null, 4)]);
    }

    // Now run the fully resolved user input against the validator
    _.forEach(scratchOrgInfoPayload, (value, key) => optionsValidator(key, value, scratchOrgInfoPayload));

    // the -i option
    if (!_.isNil(context.clientid)) {
      scratchOrgInfoPayload.connectedAppConsumerKey = context.clientid;
    }

    // the -d option
    if (!_.isNil(context.durationdays)) {
      scratchOrgInfoPayload.durationDays = context.durationdays;
    }

    // Ignore ancestor ids only when 'nonamespace' or 'noancestors' options are specified
    const ignoreAncestorIds = context.nonamespace || context.noancestors || false;

    // Throw warnings for deprecated scratch org feautures.
    const scratchOrgFeatureDeprecation = new ScratchOrgFeatureDeprecation();
    scratchOrgFeatureDeprecation.getFeatureWarnings(scratchOrgInfoPayload.features).forEach((warning) => {
      logApi.warnUser(this.cliContext, warning);
    });

    return scratchOrgInfoGenerator.generateScratchOrgInfo(
      masterOrg,
      scratchOrgInfoPayload,
      'scratch',
      context.nonamespace,
      ignoreAncestorIds
    );
  }

  parseSignupErrorCode(err) {
    const messageToParse = err.name + err.errorCode + err.message;
    return messageToParse.match(/[A-Z]{1,2}-[0-9]{4}/);
  }

  private async updateRevisionCounterToZero(scratchOrgApi: Org, orgData: any) {
    const queryResult = await this.force.toolingFind(scratchOrgApi, 'SourceMember', { RevisionCounter: { $gt: 0 } }, [
      'Id',
    ]);
    if (!_.isEmpty(queryResult)) {
      const requestBody: any = [];
      const TOOLING_UPDATE_URI = `services/data/v${this.org.force.config.getApiVersion()}/tooling/composite/batch`;
      const _url = Url.resolve(orgData.instanceUrl, TOOLING_UPDATE_URI);
      queryResult.forEach((sourceMember) => {
        requestBody.push(`{"method" : "PATCH",
        "url" : "v${this.org.force.config.getApiVersion()}/tooling/sobjects/SourceMember/${sourceMember.Id}",
        "richInput" : {"RevisionCounter" : "0"}}`);
      });
      const bodyStr = `
      {
      "batchRequests" : [ ${requestBody} ]}`;
      const headers = {
        'content-type': 'application/json',
      };
      try {
        this.force.request(scratchOrgApi, 'POST', _url, headers, bodyStr);
      } catch (err) {
        const message = messages.getMessage('SourceStatusResetFailure', [orgData.orgId, orgData.username]);
        throw new SfdxError(message, 'SourceStatusResetFailure');
      }
    }
  }

  /**
   * returns a human readable message for cli output
   *
   * @param org - the result oif execute
   * @returns {string}
   */
  getHumanSuccessMessage(org) {
    return messages.getMessage('createOrgCommandSuccess', [org.orgId, org.username]);
  }

  /**
   * returns a human readable error message for cli output
   *
   * @returns {string}
   */
  getHumanErrorMessage(err) {
    let message;

    try {
      // try and get a message associated with an embedded error code.
      const errorCode = this.parseSignupErrorCode(err);
      if (!_.isNil(errorCode) && errorCode.length > 0) {
        if (!err.action) {
          err['action'] = messages.getMessage('signupFailedAction', [errorCode]);
        }
        message = messages.getMessage(errorCode[0], [], 'signup');
        if (message.includes('%s')) {
          message = messages.getMessage(errorCode[0], [this.force.config.getWorkspaceConfigFilename()], 'signup');
        }
      } else if (err.name === 'MyDomainResolverTimeoutError') {
        // scratchOrgInfoApi adds orgId, username, and instanceUrl to the error so it's highly unlikely these
        // values won't be set. But just to be safe displaying 'undefined' instead of %s seems reasonable.
        message = messages.getMessage(
          'MyDomainResolverTimeoutError',
          [
            (err.data && err.data.orgId) || 'undefined',
            (err.data && err.data.username) || 'undefined',
            (err.data && err.data.instanceUrl) || 'undefined',
          ],
          'signup'
        );
      }
      // didn't have a salesforce formatted error code. try a lookup from just the error code
      else {
        message = messages.getMessage(err.errorCode, [this.force.config.getWorkspaceConfigFilename()], 'signup');
      }
    } catch (e) {
      // getMessage throws an error when a key is not found.
      // Use the standard error message
      message = null;
    }

    return message;
  }
}

export = OrgCreateCommand;

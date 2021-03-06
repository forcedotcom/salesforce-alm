/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { fs } from '@salesforce/core';
import * as request from 'request';
import OrgOpenCommand = require('../org/orgOpenCommand');
import * as Display from '../force-cli/force-cli-display';
import * as Config from '../force-cli/force-cli-config';
import * as Messages from '../force-cli/force-cli-messages';
import logApi = require('../core/logApi');
import MetadataRegistry = require('./metadataRegistry');

let logger;

export interface UrlObject {
  url: string;
  orgId: string;
  username: string;
}

export class SourceOpenCommand {
  constructor() {
    logger = logApi.child('source:open');
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  validate() {}

  async execute(context): Promise<any> {
    if (context && context.flags && context.flags.sourcefile) {
      try {
        fs.realpathSync(context.flags.sourcefile);
        const editOp = new SourceOpenOperation(context);
        return await editOp.execute();
      } catch (err) {
        logger.error(err);
        throw Error(err.message);
      }
    } else {
      throw Error(context.command);
    }
  }
}

export class SourceOpenOperation {
  private context: any;
  private _factory: StrategyFactory;

  constructor(context: any, factory?: StrategyFactory) {
    this.context = context;
    if (factory) {
      this.factory = factory;
    }
  }

  private set factory(factory: StrategyFactory) {
    this._factory = factory;
  }

  private get factory(): StrategyFactory {
    if (this._factory === undefined) {
      try {
        const metadataFactory = new MetadataRegistry();
        this._factory = new StrategyFactory(this.context, metadataFactory);
      } catch (e) {
        throw remapError(e);
      }
    }
    return this._factory;
  }

  public async execute(): Promise<UrlObject> {
    try {
      const strategy: EditStrategy = this.factory.strategize();
      const url: UrlObject = await strategy.open();
      if (this.context.flags.json) {
        return url;
      } else {
        Display.info(Messages.get('SourceOpenCommandHumanSuccess', url.orgId, url.username, url.url));
      }
    } catch (e) {
      throw Error(Messages.get('SourceOpenCommandHumanError', e.message));
    }
  }
}

export function remapError(e: Error): Error {
  const stack = e.stack;
  if (stack.includes('MetadataRegistry.getTypeDefsByExtension')) {
    return new Error(Messages.get('SourceOpenCommandUnpushedError'));
  } else {
    return e;
  }
}

export async function isSalesforceOneEnabled(cmd: OrgOpenCommand, requestApi: any, context: any): Promise<boolean> {
  const localContext = Object.assign({}, context, {
    flags: {
      urlonly: true,
      path: 'one/one.app',
    },
  });

  const url: UrlObject = await cmd.execute(await cmd.validate(localContext));
  return new Promise<boolean>((resolve) => {
    requestApi(url.url, (error, response, body: string) => {
      if (body && !body.includes('lightning/access/orgAccessDenied.jsp')) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

export class StrategyFactory {
  private context: any;
  private metadataRegistry: MetadataRegistry;

  constructor(context: any, metadataRegistry: MetadataRegistry) {
    this.context = context;
    this.metadataRegistry = metadataRegistry;
  }

  public strategize(): EditStrategy {
    const absoluteFilePath = path.resolve(this.context.flags.sourcefile);
    const type = this.metadataRegistry.getTypeDefinitionByFileName(absoluteFilePath);

    if (type) {
      if (type.metadataName === 'FlexiPage') {
        return new FlexipageStrategy(this.context, new OrgOpenCommand());
      }
    }

    return new DefaultStrategy(this.context, new OrgOpenCommand());
  }
}

export interface EditStrategy {
  open(): Promise<UrlObject>;
}

export class FlexipageStrategy implements EditStrategy {
  private static NO_ID = undefined;
  private context: any;
  private cmd: OrgOpenCommand;

  constructor(context: any, cmd: OrgOpenCommand) {
    this.context = context;
    this.cmd = cmd;
  }

  public async deriveFlexipageURL(flexipage: string): Promise<string | undefined> {
    const connection = await Config.getActiveConnection(this.context);
    try {
      const queryResult = await connection.tooling.query(`SELECT id FROM flexipage WHERE DeveloperName='${flexipage}'`);
      if (queryResult.totalSize === 1 && queryResult.records) {
        const record: any = queryResult.records[0];
        return record.Id;
      } else {
        return FlexipageStrategy.NO_ID;
      }
    } catch (err) {
      return FlexipageStrategy.NO_ID;
    }
  }

  public async setUpOpenContext(): Promise<any> {
    const openContext = Object.assign({}, this.context);
    const id = await this.deriveFlexipageURL(path.basename(this.context.flags.sourcefile, '.flexipage-meta.xml'));
    const salesforceOne = await exports.isSalesforceOneEnabled(this.cmd, request, openContext);
    if (id) {
      openContext.flags.path = `/visualEditor/appBuilder.app?pageId=${id}`;
    } else {
      if (salesforceOne) {
        openContext.flags.path = '/one/one.app#/setup/FlexiPageList/home';
      } else {
        openContext.flags.path = '_ui/flexipage/ui/FlexiPageFilterListPage';
      }
    }
    return openContext;
  }

  public async open(): Promise<UrlObject> {
    const context = await this.cmd.validate(await this.setUpOpenContext());
    return await this.cmd.execute(context);
  }
}

export class DefaultStrategy implements EditStrategy {
  private context: any;
  private cmd: OrgOpenCommand;

  constructor(context: any, cmd: OrgOpenCommand) {
    this.context = context;
    this.cmd = cmd;
  }

  public async open(): Promise<UrlObject> {
    return await this.cmd.execute(await this.cmd.validate(this.context));
  }
}

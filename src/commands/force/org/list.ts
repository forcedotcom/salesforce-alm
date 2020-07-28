/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthInfo, ConfigAggregator, ConfigInfo, Connection, Org, SfdxError } from '@salesforce/core';
import { ExtendedAuthFields, OrgListUtil } from '../../../lib/org/orgListUtil';

import * as _ from 'lodash';
import logger = require('../../../lib/core/logApi');
import Messages = require('../../../lib/messages');
import OrgDecorator = require('../../../lib/org/orgHighlighter');

const messages = Messages();

export class OrgListCommand extends SfdxCommand {
  public static readonly help = messages.getMessage('help', [], 'org_list');
  public static readonly description =
    messages.getMessage('description', [], 'org_list') + '\n\n' + OrgListCommand.help;
  public static readonly longDescription = messages.getMessage('longDescription', [], 'org_list');

  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    verbose: flags.builtin({
      description: messages.getMessage('verbose', [], 'org_list'),
      longDescription: messages.getMessage('verboseLong', [], 'org_list')
    }),
    all: flags.boolean({
      description: messages.getMessage('all', [], 'org_list'),
      longDescription: messages.getMessage('allLong', [], 'org_list'),
      required: false
    }),
    clean: flags.boolean({
      description: messages.getMessage('clean', [], 'org_list'),
      longDescription: messages.getMessage('cleanLong', [], 'org_list'),
      required: false
    }),
    noprompt: flags.boolean({
      char: 'p',
      description: messages.getMessage('noPrompt', [], 'org_list'),
      longDescription: messages.getMessage('noPromptLong', [], 'org_list'),
      required: false
    }),
    skipconnectionstatus: flags.boolean({
      description: messages.getMessage('skipConnectionStatus', [], 'org_list'),
      longDescription: messages.getMessage('skipConnectionStatus', [], 'org_list'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    this.logger = logger.child('OrgListCommand');
    const orgDecorator = new OrgDecorator(!this.flags.json);
    const sortAndDecorateFunc = (val: ExtendedAuthFields) => {
      this._extractDefaultOrgStatus(val);
      const sortVal = val.username;
      orgDecorator.decorateStatus(val);
      orgDecorator.decorateConnectedStatus(val);

      return [val.alias, sortVal];
    };

    let fileNames: string[] = [];
    try {
      fileNames = await AuthInfo.listAllAuthFiles();
    } catch (error) {
      if (error.name === 'NoAuthInfoFound') {
        const msg = messages.getMessage('noOrgsFound', [], 'scratchOrgApi');
        const action = messages.getMessage('noOrgsFoundAction', [], 'scratchOrgApi');
        throw new SfdxError(msg, 'noOrgsFound', [action]);
      } else {
        throw error;
      }
    }

    const metaConfigs = await OrgListUtil.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, this.flags);
    const data = {
      nonScratchOrgs: _.sortBy(metaConfigs.nonScratchOrgs, sortAndDecorateFunc),
      expiredScratchOrgs: _.sortBy(metaConfigs.expiredScratchOrgs, sortAndDecorateFunc),
      activeScratchOrgs: _.sortBy(metaConfigs.activeScratchOrgs, sortAndDecorateFunc),
      totalScratchOrgs: _.sortBy(metaConfigs.totalScratchOrgs)
    };

    if (this.flags.clean) {
      await this.cleanScratchOrgs(data.expiredScratchOrgs, !this.flags.noprompt);
    }

    if (data.expiredScratchOrgs.length > 10 && !this.flags.clean) {
      this.ux.warn(messages.getMessage('deleteOrgs', data.expiredScratchOrgs.length, 'org_list'));
    }

    const result = {
      nonScratchOrgs: [],
      scratchOrgs: []
    };
    result.nonScratchOrgs = data.nonScratchOrgs;

    this.ux.styledHeader('Orgs');

    this.printOrgTable(data.nonScratchOrgs, this.flags.skipconnectionstatus);
    // separate the table by a blank line.
    this.ux.log();
    if (this.flags.all) {
      this.printScratchOrgTable(data.totalScratchOrgs);
      result.scratchOrgs = data.totalScratchOrgs;
    } else {
      this.printScratchOrgTable(data.activeScratchOrgs);
      result.scratchOrgs = data.activeScratchOrgs;
    }
    return result;
  }

  protected async cleanScratchOrgs(scratchOrgs: ExtendedAuthFields[], prompt?: boolean) {
    if (scratchOrgs.length > 0) {
      const answer = prompt
        ? await this.ux.prompt(messages.getMessage('prompt', [scratchOrgs.length], 'org_list'))
        : await Promise.resolve('Y');

      if (answer.toUpperCase() === 'YES' || answer.toUpperCase() === 'Y') {
        for (const fields of scratchOrgs) {
          try {
            const authInfo = await AuthInfo.create({ username: fields.username });
            // Force an api version to prevent connection check with the server for expired orgs.
            // tslint:disable-next-line: no-object-literal-type-assertion
            const connection = await Connection.create({
              authInfo,
              configAggregator: ({
                // tslint:disable-next-line: no-object-literal-type-assertion
                getInfo: () => (({ value: '47.0' } as unknown) as ConfigInfo)
              } as unknown) as ConfigAggregator
            });
            const org = await Org.create({ aliasOrUsername: fields.username, connection });
            await org.remove();
          } catch (e) {
            this.logger.debug(`Error cleaning org ${fields.username}: ${e.message}`);
          }
        }
      }
    }
  }

  protected printOrgTable(data, skipconnectionstatus) {
    // default columns for the non-scratch org list
    const nonScratchOrgColumns = [
      { key: 'defaultMarker', label: '' },
      { key: 'alias', label: 'ALIAS' },
      { key: 'username', label: 'USERNAME' },
      { key: 'orgId', label: 'ORG ID' }
    ];

    if (!skipconnectionstatus) {
      nonScratchOrgColumns.push({ key: 'connectedStatus', label: 'CONNECTED STATUS' });
    }

    if (data.length) {
      this.ux.table(data, { columns: nonScratchOrgColumns });
    } else {
      this.ux.log(messages.getMessage('noResultsFound'));
    }
    return;
  }

  private printScratchOrgTable(data) {
    if (data.length === 0) {
      this.ux.log(messages.getMessage('noActiveScratchOrgs', null, 'org_list'));
    } else {
      // One or more rows are available.
      this.ux.table(data, { columns: this.getScratchOrgColumnData() });
    }
  }

  private getScratchOrgColumnData() {
    // default columns for the scratch org list
    const scratchOrgColumns = [];
    scratchOrgColumns.push(
      { key: 'defaultMarker', label: '' },
      { key: 'alias', label: 'ALIAS' },
      { key: 'username', label: 'USERNAME' },
      { key: 'orgId', label: 'ORG ID' }
    );

    if (this.flags.all || this.flags.verbose) {
      scratchOrgColumns.push({ key: 'status', label: 'STATUS' });
    }

    // scratch org verbose columns
    if (this.flags.verbose) {
      scratchOrgColumns.push({ key: 'devHubOrgId', label: 'DEV HUB' });
      scratchOrgColumns.push({ key: 'createdDate', label: 'CREATED DATE' });
      scratchOrgColumns.push({ key: 'instanceUrl', label: 'INSTANCE URL' });
    }

    // scratch org expiration date should be on the end.
    scratchOrgColumns.push({ key: 'expirationDate', label: 'EXPIRATION DATE' });

    return scratchOrgColumns;
  }

  private _extractDefaultOrgStatus(val) {
    // I'll use the sort function as a decorator so I can eliminate the need to loop.
    if (val.isDefaultDevHubUsername) {
      val.defaultMarker = '(D)';
    } else if (val.isDefaultUsername) {
      val.defaultMarker = '(U)';
    }
  }
}

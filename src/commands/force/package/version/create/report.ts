/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import Messages = require('../../../../../lib/messages');
import { ToolbeltCommand } from '../../../../../ToolbeltCommand';

const messages = Messages();
import consts = require('../../../../../lib/core/constants');

export class PackageVersionCreateReportCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_version_create_report');
  public static readonly longDescription = messages.getMessage(
    'cliLongDescription',
    [],
    'package_version_create_report'
  );
  public static readonly help = messages.getMessage('help', [], 'package_version_create_report');
  public static readonly requiresProject = false;
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    packagecreaterequestid: flags.id({
      char: 'i',
      description: messages.getMessage('requestId', [], 'package_version_create_report'),
      longDescription: messages.getMessage('requestIdLong', [], 'package_version_create_report'),
      required: true
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageVersionCreateRequestReportCommand = require('../../../../../lib/package/packageVersionCreateRequestReportCommand');
    return this.execLegacyCommand(new PackageVersionCreateRequestReportCommand(), context);
  }
}

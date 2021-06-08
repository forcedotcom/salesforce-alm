/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import { Duration } from '@salesforce/kit';
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();
import consts = require('../../../../lib/core/constants');

export class PackageVersionCreateCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('cliDescription', [], 'package_version_create');
  public static readonly longDescription = messages.getMessage('cliLongDescription', [], 'package_version_create');
  public static readonly help = messages.getMessage('help', [], 'package_version_create');
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package', [], 'package_version_create'),
      longDescription: messages.getMessage('longPackage', [], 'package_version_create'),
      required: false,
    }),
    path: flags.directory({
      char: 'd',
      description: messages.getMessage('path', [], 'package_version_create'),
      longDescription: messages.getMessage('longPath', [], 'package_version_create'),
      required: false,
    }),
    definitionfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('definitionfile', [], 'package_version_create'),
      longDescription: messages.getMessage('longDefinitionfile', [], 'package_version_create'),
      required: false,
    }),
    branch: flags.string({
      char: 'b',
      description: messages.getMessage('branch', [], 'package_version_create'),
      longDescription: messages.getMessage('longBranch', [], 'package_version_create'),
      required: false,
    }),
    tag: flags.string({
      char: 't',
      description: messages.getMessage('tag', [], 'package_version_create'),
      longDescription: messages.getMessage('longTag', [], 'package_version_create'),
      required: false,
    }),
    installationkey: flags.string({
      char: 'k',
      description: messages.getMessage('key', [], 'package_version_create'),
      longDescription: messages.getMessage('longKey', [], 'package_version_create'),
      required: false,
    }),
    installationkeybypass: flags.boolean({
      char: 'x',
      description: messages.getMessage('keyBypass', [], 'package_version_create'),
      longDescription: messages.getMessage('longKeyBypass', [], 'package_version_create'),
      required: false,
    }),
    preserve: flags.boolean({
      char: 'r',
      description: messages.getMessage('preserve', [], 'package_version_create'),
      longDescription: messages.getMessage('longPreserve', [], 'package_version_create'),
      required: false,
      hidden: true,
    }),
    validateschema: flags.boolean({
      char: 'j',
      description: messages.getMessage('validateschema', [], 'package_version_create'),
      longDescription: messages.getMessage('longValidateschema', [], 'package_version_create'),
      required: false,
      hidden: true,
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('wait', [], 'package_version_create'),
      longDescription: messages.getMessage('longWait', [], 'package_version_create'),
      required: false,
      default: Duration.minutes(0),
    }),
    buildinstance: flags.string({
      char: 's',
      description: messages.getMessage('instance', [], 'package_version_create'),
      longDescription: messages.getMessage('longInstance', [], 'package_version_create'),
      required: false,
      hidden: true,
    }),
    sourceorg: flags.string({
      char: 'o',
      description: messages.getMessage('sourceorg', [], 'package_version_create'),
      longDescription: messages.getMessage('longSourceorg', [], 'package_version_create'),
      required: false,
      hidden: true,
    }),
    versionname: flags.string({
      char: 'a',
      description: messages.getMessage('versionname', [], 'package_version_create'),
      longDescription: messages.getMessage('longVersionname', [], 'package_version_create'),
      required: false,
    }),
    versionnumber: flags.string({
      char: 'n',
      description: messages.getMessage('versionnumber', [], 'package_version_create'),
      longDescription: messages.getMessage('longVersionnumber', [], 'package_version_create'),
      required: false,
    }),
    versiondescription: flags.string({
      char: 'e',
      description: messages.getMessage('versiondescription', [], 'package_version_create'),
      longDescription: messages.getMessage('longVersiondescription', [], 'package_version_create'),
      required: false,
    }),
    codecoverage: flags.boolean({
      char: 'c',
      description: messages.getMessage('codeCoverage', [], 'package_version_create'),
      longDescription: messages.getMessage('longCodeCoverage', [], 'package_version_create'),
      required: false,
      default: false,
    }),
    releasenotesurl: flags.url({
      description: messages.getMessage('releaseNotesUrl', [], 'package_version_create'),
      longDescription: messages.getMessage('releaseNotesUrlLong', [], 'package_version_create'),
      required: false,
    }),
    postinstallurl: flags.url({
      description: messages.getMessage('postInstallUrl', [], 'package_version_create'),
      longDescription: messages.getMessage('postInstallUrlLong', [], 'package_version_create'),
      required: false,
    }),
    postinstallscript: flags.string({
      description: messages.getMessage('postInstallScript', [], 'package_version_create'),
      longDescription: messages.getMessage('postInstallScriptLong', [], 'package_version_create'),
      required: false,
    }),
    uninstallscript: flags.string({
      description: messages.getMessage('uninstallScript', [], 'package_version_create'),
      longDescription: messages.getMessage('uninstallScriptLong', [], 'package_version_create'),
      required: false,
    }),
    skipvalidation: flags.boolean({
      description: messages.getMessage('skipValidation', [], 'package_version_create'),
      longDescription: messages.getMessage('skipValidationLong', [], 'package_version_create'),
      required: false,
      default: false,
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const PackageVersionCreateCommandImpl = require('../../../../lib/package/packageVersionCreateCommand');
    return this.execLegacyCommand(new PackageVersionCreateCommandImpl(), context);
  }
}

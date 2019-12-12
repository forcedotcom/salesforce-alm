/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is a doc command
/* istanbul ignore file */

import { SfdxCommand } from '@salesforce/command';
import { Config } from '../lib/core/configApi';

const _getAsciiSignature = apiVersion => `
                 DX DX DX
             DX DX DX DX DX DX          DX DX DX
          DX DX DX      DX DX DX    DX DX DX DX DX DX
        DX DX              DX DX DX DX DX     DX DX DX
       DX DX                 DX DX DX             DX DX    DX DX DX
      DX DX                    DX DX                DX DX DX DX DX DX DX
     DX DX                                          DX DX DX       DX DX DX
     DX DX                                            DX             DX DX DX
      DX DX                                                              DX DX
      DX DX                                                               DX DX
       DX DX                                                              DX DX
     DX DX                                                                 DX DX
   DX DX                                                                   DX DX
 DX DX                                                                     DX DX
DX DX                                                                     DX DX
DX DX                                                                    DX DX
DX DX                                                                   DX DX
 DX DX                                                    DX          DX DX
 DX DX                                                  DX DX DX DX DX DX
  DX DX                                                 DX DX DX DX DX
    DX DX DX   DX DX                     DX           DX DX
       DX DX DX DX DX                   DX DX DX DX DX DX
          DX DX  DX DX                  DX DX DX DX DX
                  DX DX              DX DX
                    DX DX DX     DX DX DX
                      DX DX DX DX DX DX                     v${apiVersion}
                          DX DX DX

* Salesforce CLI Release Notes: https://developer.salesforce.com/media/salesforce-cli/releasenotes.html
* Salesforce DX Setup Guide: https://sfdc.co/sfdx_setup_guide
* Salesforce DX Developer Guide: https://sfdc.co/sfdx_dev_guide
* Salesforce CLI Command Reference: https://sfdc.co/sfdx_cli_reference
* Salesforce Extensions for VS Code: https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode
`;

export class ForceCommand extends SfdxCommand {
  public static readonly hidden = true;

  public async run(): Promise<{ apiVersion: string }> {
    const apiVersion = new Config().getApiVersion();
    this.ux.log(_getAsciiSignature(apiVersion));
    return { apiVersion };
  }

  protected _help() {
    const HHelp = require('@oclif/plugin-help').default;
    const help = new HHelp(this.config);
    // We need to include force in the args for topics to be shown
    help.showHelp(process.argv.slice(2));
    return this.exit(0);
  }
}

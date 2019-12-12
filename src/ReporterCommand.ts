/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { flags } from '@salesforce/command';
import { ToolbeltCommand } from './ToolbeltCommand';
import Output = flags.Output;

export type ResultFormatOptions = {
  options?: string[];
  default?: string;
};

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('salesforce-alm', 'reporterCommand');

/**
 * Support --resultfomat on commands. Useful for commands that can output different
 * formats like human, csv, json, or different testing results like tap, etc.
 */
export abstract class ReporterCommand extends ToolbeltCommand {
  public static resultFormatOptions: ResultFormatOptions = {};

  public static get flags(): Output {
    if (!this.flagsConfig) {
      this.flagsConfig = {};
    }
    this.flagsConfig.resultformat = flags.enum(
      Object.assign(
        {
          char: 'r',
          description: messages.getMessage('ResultFormatDescription'),
          longDescription: messages.getMessage('ResultFormatLongDescription'),
          options: ['human', 'csv', 'json']
        },
        this.resultFormatOptions
      )
    );
    return super.flags;
  }

  // Override the init to set this.json if the --resultformat (reporter) flag is json
  protected async init() {
    try {
      const { flags } = this.parse({
        flags: this.statics.flags,
        args: this.statics.args
      });

      // Set json if the reporter is json
      if (flags.resultformat === 'json' && !flags.json) {
        this.argv.push('--json');
      }
    } catch (err) {
      /* parse can throw, so let super.init handle those */
    }
    return super.init();
  }

  // TypeScript does not yet have assertion-free polymorphic access to a class's static side from the instance side
  protected get statics(): typeof ToolbeltCommand {
    return this.constructor as typeof ToolbeltCommand;
  }
}

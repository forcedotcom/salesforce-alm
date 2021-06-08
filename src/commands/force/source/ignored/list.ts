/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { fs as fsCore, Messages } from '@salesforce/core';
import { ForceIgnore } from '@salesforce/source-deploy-retrieve';

Messages.importMessagesDirectory(__dirname);

const messages: Messages = Messages.loadMessages('salesforce-alm', 'source_ignored');

export type SourceIgnoredResults = {
  ignoredFiles: string[];
};

export class SourceIgnoredCommand extends SfdxCommand {
  private forceIgnore: ForceIgnore;
  private ignoredFiles: string[] = [];

  public static readonly description = messages.getMessage('cmdDescription');
  public static readonly requiresProject = true;

  public static readonly flagsConfig: FlagsConfig = {
    sourcepath: flags.filepath({
      char: 'p',
      description: messages.getMessage('sourcepathDescription'),
    }),
  };

  /**
   * Outputs all forceignored files from package directories of a project,
   * or based on a sourcepath param that points to a specific file or directory.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async run(): Promise<SourceIgnoredResults> {
    this.forceIgnore = ForceIgnore.findAndCreate(this.project.getPath());

    let sourcepaths: string[];
    if (this.flags.sourcepath) {
      sourcepaths = [this.flags.sourcepath];
    } else {
      sourcepaths = this.project.getUniquePackageDirectories().map((pDir) => pDir.path);
    }
    sourcepaths.forEach((sp) => this.statIgnored(sp.trim()));

    // Command output
    if (this.ignoredFiles.length) {
      this.ux.log('Found the following ignored files:');
      this.ignoredFiles.forEach((filepath) => this.ux.log(filepath));
    } else {
      this.ux.log('No ignored files found in paths:');
      sourcepaths.forEach((sp) => this.ux.log(sp));
    }

    return { ignoredFiles: this.ignoredFiles };
  }

  // Stat the filepath.  Test if a file, recurse if a directory.
  private statIgnored(filepath: string) {
    const stats = fsCore.statSync(filepath);
    if (stats.isDirectory()) {
      this.findIgnored(filepath);
    } else {
      this.testIgnored(filepath);
    }
  }

  // Recursively search a directory for source files to test.
  private findIgnored(dir: string) {
    this.logger.debug(`Searching dir: ${dir}`);
    const files = fsCore.readdirSync(dir);

    for (const filename of files) {
      this.statIgnored(path.join(dir, filename));
    }
  }

  // Test if a source file is denied, adding any ignored files to
  // the ignoredFiles array for output.
  private testIgnored(filepath: string) {
    const isDenied = this.forceIgnore.denies(filepath);
    let msg = 'ACCEPTED';
    if (isDenied) {
      msg = 'DENIED';
      this.ignoredFiles.push(filepath);
    }
    this.logger.debug(`[${msg}]: ${filepath}`);
  }
}

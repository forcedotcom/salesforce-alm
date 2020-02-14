/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as gitignoreParser from 'gitignore-parser';
import * as fs from 'fs';
import * as path from 'path';

import * as projectDirUtil from '../core/projectDir';

export class ForceIgnore {
  private pathToForceIgnoreFile;
  private parser;

  constructor(pathToForceIgnoreFile = projectDirUtil.getPath()) {
    this.pathToForceIgnoreFile = pathToForceIgnoreFile;
    try {
      const forceIgnoreContents = this.parseContents(
        fs.readFileSync(path.join(this.pathToForceIgnoreFile, '.forceignore'), 'utf8')
      );
      this.parser = gitignoreParser.compile(forceIgnoreContents);
    } catch (err) {
      this.parser = null;
    }
  }

  public denies(file: string): boolean {
    let denies = false;
    if (this.parser) {
      denies = this.parser.denies(path.relative(this.pathToForceIgnoreFile, file));
    }
    return denies;
  }

  public accepts(file: string): boolean {
    let accepts = true;
    if (this.parser) {
      accepts = this.parser.accepts(path.relative(this.pathToForceIgnoreFile, file));
    }
    return accepts;
  }

  private parseContents(contents: string): string {
    return contents
      .split('\n')
      .map(line => line.trim())
      .map(line => line.replace(/[\\\/]/g, path.sep))
      .map(line => line.replace(/^\\/, ''))
      .join('\n');
  }
}

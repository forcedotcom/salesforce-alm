/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as fs from 'fs-extra';

import { DefaultMetadataType } from './defaultMetadataType';
import * as PathUtil from '../sourcePathUtil';

export class CustomObjectTranslationMetadataType extends DefaultMetadataType {
  getAggregateMetadataFilePathFromWorkspacePath(filePath): string {
    return PathUtil.removeParentDirFromPath(filePath);
  }

  entityExistsInWorkspace(metadataFilePath: string): boolean {
    const aggregateFullName = this.getAggregateFullNameFromFilePath(metadataFilePath);
    return fs.existsSync(path.join(path.dirname(metadataFilePath), aggregateFullName));
  }

  // CustomObjectTranslations are only coarsely tracked so we only want to report
  // that a COT has generally changed rather than reporting each associated filePath
  displayAggregateRemoteChangesOnly(): boolean {
    return true;
  }
}

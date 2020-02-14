/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as fs from 'fs-extra';

import { DefaultMetadataType } from './defaultMetadataType';
import * as PathUtil from '../sourcePathUtil';

export class CustomObjectMetadataType extends DefaultMetadataType {
  hasIndividuallyAddressableChildWorkspaceElements(): boolean {
    return true;
  }

  getAggregateMetadataFilePathFromWorkspacePath(filePath): string {
    return PathUtil.removeParentDirFromPath(filePath);
  }

  entityExistsInWorkspace(metadataFilePath: string): boolean {
    const aggregateFullName = this.getAggregateFullNameFromFilePath(metadataFilePath);
    return fs.existsSync(path.join(path.dirname(metadataFilePath), aggregateFullName));
  }

  /**
   * W-4594933: Converting mdapi source that only contains "decomposed" metadata elements will
   * result in an empty CustomObject container file created. This container file,
   * which meets the below criteria, is invalid
   * @param container
   * @returns {boolean}
   */
  isContainerValid(container): boolean {
    const containerDataNodes = container.data.childNodes;
    return !(
      containerDataNodes &&
      containerDataNodes[0].tagName == 'xml' &&
      containerDataNodes[1].tagName == this.getMetadataName() &&
      containerDataNodes[1].childNodes.length == 0
    );
  }
}

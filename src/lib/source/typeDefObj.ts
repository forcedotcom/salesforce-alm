/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DecompositionConfig } from './decompositionStrategy/decompositionConfig';

export class TypeDefObj {
  metadataName: string;
  ext: string;
  hasContent: boolean;
  defaultDirectory: string;
  nameForMsgs: string;
  nameForMsgsPlural: string;
  contentIsBinary: boolean;
  isAddressable: boolean;
  isSourceTracked: boolean;
  childXmlNames: string[];
  hasStandardMembers: boolean;
  deleteSupported: boolean;
  decompositionConfig: DecompositionConfig;
  hasVirtualSubtypes: boolean;
  inFolder: boolean;
  folderTypeDef: TypeDefObj;
  isGlobal: boolean;
  isEmptyContainer: boolean;
  parent: TypeDefObj;

  constructor(metadataName) {
    this.metadataName = metadataName;

    // defaults
    this.isAddressable = true;
    this.isSourceTracked = true;
  }
}

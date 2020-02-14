/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import { DefaultMetadataType } from './defaultMetadataType';
import MetadataRegistry = require('../metadataRegistry');

export class CustomPageWeblinkMetadataType extends DefaultMetadataType {
  protected getMdapiFormattedMetadataFileName(metadataFilePath: string): string {
    const fileName = path.basename(metadataFilePath);
    return fileName.replace(`.${this.typeDefObj.ext}${MetadataRegistry.getMetadataFileExt()}`, '.weblink');
  }
}

/*
 * Copyright (c) 2017, Salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

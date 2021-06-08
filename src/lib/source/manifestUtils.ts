/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AnyJson } from '@salesforce/ts-types';
import * as PathUtil from '../source/sourcePathUtil';
import { ManifestEntry, SourceOptions } from './types';
import * as ManifestCreateApi from './manifestCreateApi';

// eslint-disable-next-line @typescript-eslint/require-await
export const toManifest = async function (
  org: any,
  options: SourceOptions,
  tmpOutputDir?: string
): Promise<string | null> {
  if (options && options.metadata) {
    const entries: ManifestEntry[] = parseManifestEntries(options.metadata);
    if (entries != null) {
      // Create a manifest and update the options with the manifest file.
      options.manifest = (await createManifest(org, options, entries, tmpOutputDir)).file;
      return options.manifest;
    } else {
      return null;
    }
  }
  return null;
};

/**
 * Function to create a manifest for a given org
 *
 * @param org {AnyJson} An org
 * @param options {SourceOptions} Source options
 * @param mdPairs {ManifestEntry[]} Array of metadata items
 * @returns A package.xml manifest
 */
export const createManifest = function (
  org: AnyJson,
  options: SourceOptions,
  mdPairs: ManifestEntry[] = [],
  tmpOutputDir?: string
): Promise<{ file: string }> {
  if (!org || !options) {
    return null;
  }

  const manifestApi = new ManifestCreateApi(org);

  // Create the package.xml in the temp dir
  const manifestOptions = Object.assign({}, options, {
    outputdir: tmpOutputDir,
  });
  return manifestApi.createManifest(manifestOptions, null, mdPairs);
};

/**
 * Parse manifest entry strings into an array of ManifestEntry objects
 *
 * @param arg {string} The entry string; e.g., "ApexClass, CustomObject:MyObjectName"
 */
export const parseManifestEntries = function (entries: string): ManifestEntry[] | null {
  if (entries) {
    const mdParamArray = entries.split(',');
    return mdParamArray.map((md) => {
      const [mdType, ...rest] = md.split(':');
      const mdName = rest.length ? rest.join(':') : '*';
      return { type: mdType.trim(), name: PathUtil.replaceForwardSlashes(mdName.trim()) };
    });
  }
  return null;
};

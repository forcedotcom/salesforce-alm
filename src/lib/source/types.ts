/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Type use for individual elements of a package.xml
 * ApexClass: Foo
 */
export interface ManifestEntry {
  type: string;
  name: string;
}

/**
 * Capture common source scope options across retrieve and deploy.
 */
export interface SourceOptions {
  manifest?: string;
  metadata?: string;
  sourcepath?: string;
}

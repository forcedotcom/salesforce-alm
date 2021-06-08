/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isEmpty } from 'lodash';
import { JsonMap } from '@salesforce/ts-types';
import { SfdxError } from '@salesforce/core/lib/sfdxError';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);

/**
 * A parser for the CommunityCreateCommand varargs.
 */
export class CommunityNameValueParser {
  private patterns: string[];

  /**
   * The caller/creator of the parser needs to pass in some patterns to validate.
   *
   * These patterns are joined together in a RegExp and matched against the "name" portion of the vararg.
   *
   * e.g.
   * let parser = new CommunityNameValueParser([ "name", "template" ]);
   * parser.parse([ "name=Demo", "template=\"Customer Service\"" ]); // passes
   * parser.parse([ "name=Demo", "urlpathprefix=pathToDemo" ]); // fails
   * parser.parse([ "nameOne=Demo" ]); // fails
   * parser.parse([ "thename=Demo" ]); // fails
   * parser.parse([ "Name=Demo" ]); // fails
   *
   * The patterns are joined between a /^(...)$/ RegExp enclosure so it only accepts exact matches that are case sensitive. (See validate().)
   *
   * However, you can use regular expressions to allow for pattern matches.
   *
   * let parser = new CommunityNameValueParser([ "name", "template\\.\\w+" ]);
   * parser.parse([ "template.anything=substance" ]); // passes
   * parser.parse([ "name=Demo", "template=\"Customer Service\"" ]); // fails
   * parser.parse([ "name=Demo", "template.=templateOne" ]); // fails
   */
  constructor(patternsToValidate: string[] = ['.+']) {
    this.patterns = patternsToValidate;
  }

  public parse(args: string[]): JsonMap {
    const mappings: Array<[string, string]> = this.parseKeyValuePairs(args);
    this.validate(mappings);

    const values: JsonMap = this.buildJsonMapFromKeyValues(mappings);

    return values;
  }

  private parseKeyValuePairs(args: string[]): Array<[string, string]> {
    const keyValues = args.reduce(function (collection, terms) {
      const [key, value]: string[] = terms.split(/=(.*)/);
      collection.push([key, value]);
      return collection;
    }, [] as Array<[string, string]>);
    return keyValues;
  }

  private validate(parsedArgs: Array<[string, string]>): void {
    const pattern = new RegExp('^(' + this.patterns.join('|') + ')$');

    const errors: string[] = parsedArgs
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([key, value]) => !pattern.test(key))
      .map(([key, value]) => `${key}="${value}"`);

    if (!isEmpty(errors)) {
      throw SfdxError.create('salesforce-alm', 'community_commands', 'create.error.invalidVarargs', errors);
    }
  }

  private buildJsonMapFromKeyValues(keyValues: Array<[string, string]>): JsonMap {
    let results: JsonMap = {};
    keyValues.forEach(([key, value]) => {
      results = this.setValue(key, value, results);
    });
    return results;
  }

  private setValue(hyperKey: string, value: string, json: JsonMap = {}): JsonMap {
    const keys: string[] = hyperKey.split('.');
    const lastKey: string = keys[keys.length - 1];

    const last = keys
      .slice(0, -1)
      .reduce((map, index) => (map[index] = map[index] === undefined ? {} : map[index]), json);
    last[lastKey] = value;

    return json;
  }
}

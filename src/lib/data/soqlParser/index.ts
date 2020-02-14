/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { InputStream, CommonTokenStream } from 'antlr4';
import { Logger } from '@salesforce/core';

import { SOQLLexer } from '../../../../gen/SOQLLexer';
import { SOQLParser } from '../../../../gen/SOQLParser';

function parseSOQL(soql: string) {
  const chars = new InputStream(soql);
  const lexer = new SOQLLexer(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new SOQLParser(tokens);
  parser['buildParseTrees'] = true;
  return parser.soql_query();
}

export class Field {
  public name: string;

  constructor(name: string) {
    this.name = name;
  }
}

export class SubqueryField extends Field {
  public fields: Field[] = [];
}

export class FunctionField extends Field {
  public alias: string;
}

export function getFields(soql: string, logger?: Logger): Field[] {
  const soqlTree = parseSOQL(soql);
  const selectClause = soqlTree.select_clause();
  const fieldSpecs = selectClause.select_spec();

  const fields = [];

  fieldSpecs.forEach(spec => {
    try {
      if (spec.field_spec()) {
        fields.push(new Field(spec.field_spec().getText()));
      } else if (spec.soql_subquery()) {
        const field = new SubqueryField(
          spec
            .soql_subquery()
            .from_clause()
            .object_spec()[0]
            .getText()
        );
        const innerSpecs = spec
          .soql_subquery()
          .subquery_select_clause()
          .subquery_select_spec();

        innerSpecs.forEach(innerField => {
          field.fields.push(new Field(innerField.field_spec().getText()));
        });
        fields.push(field);
      } else if (spec.function_call_spec()) {
        const field = new FunctionField(
          spec
            .function_call_spec()
            .function_call()
            .getText()
        );
        if (spec.function_call_spec().alias()) {
          field.alias = spec
            .function_call_spec()
            .alias()
            .getText();
        }
        fields.push(field);
      }
    } catch (e) {
      // Instead of blowing up and not showing any results, just log the error.
      logger && logger.warn(`Error parsing field spec for query ${soql} - ${e.message}`);
    }
  });

  return fields;
}

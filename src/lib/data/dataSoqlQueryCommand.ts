/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';
import * as Display from '../force-cli/force-cli-display';
import * as Config from '../force-cli/force-cli-config';
import * as Messages from '../force-cli/force-cli-messages';
import { ensureJsonArray, ensureJsonMap, ensureString, toJsonMap, isJsonArray } from '@salesforce/ts-types';
import { Reporter } from '../../lib/test/reporter';
import { EOL } from 'os';
import { Connection, QueryResult } from 'jsforce';

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
class QueryReporter extends Reporter {
  public columns: Field[];

  constructor(protected conn: Connection, protected query: string, logger?) {
    super(logger);
  }

  public getBaseUrl() {
    return this.conn._baseUrl();
  }

  async retrieveColumns() {
    const columnUrl = `${this.getBaseUrl()}/query?q=${encodeURIComponent(this.query)}&columns=true`;
    const results = toJsonMap(await this.conn.request(columnUrl));
    this.columns = [];
    for (let column of ensureJsonArray(results.columnMetadata)) {
      column = ensureJsonMap(column);
      const name = ensureString(column.columnName);

      if (isJsonArray(column.joinColumns) && column.joinColumns.length > 0) {
        if (column.aggregate) {
          const field = new SubqueryField(name);
          for (const subcolumn of column.joinColumns) {
            field.fields.push(new Field(ensureString(ensureJsonMap(subcolumn).columnName)));
          }
          this.columns.push(field);
        } else {
          for (const subcolumn of column.joinColumns) {
            this.columns.push(new Field(`${name}.${ensureString(ensureJsonMap(subcolumn).columnName)}`));
          }
        }
      } else if (column.aggregate) {
        const field = new FunctionField(ensureString(column.displayName));
        // If it isn't an alias, skip so the display name is used when messaging rows
        if (!name.match(/expr[0-9]+/)) {
          field.alias = name;
        }
        this.columns.push(field);
      } else {
        this.columns.push(new Field(name));
      }
    }
    return this.columns;
  }
}

type Errorable = Error | null;

export class HumanReporter extends QueryReporter {
  parseFields() {
    const fields = this.columns;
    // Field names
    let attributeNames = [];

    // For subqueries. Display the children under the parents
    const children = [];

    // For function fields, like avg(total).
    const aggregates = [];

    if (fields) {
      this.logger.info(`Found fields ${JSON.stringify(fields.map(field => `${typeof field}.${field.name}`))}`);

      fields.forEach(field => {
        if (field instanceof SubqueryField) {
          children.push(field.name);
          field.fields.forEach(subfield => attributeNames.push(`${field.name}.${subfield.name}`));
        } else if (field instanceof FunctionField) {
          if (field.alias) {
            attributeNames.push(field.alias);
          } else {
            attributeNames.push(field.name);
          }
          aggregates.push(field);
        } else {
          attributeNames.push(field.name);
        }
      });
    } else {
      this.logger.info(`No fields found for query "${this.query}"`);
    }

    return { attributeNames, children, aggregates };
  }
  massageRows(queryResults, children, aggregates) {
    // There are subqueries or aggregates. Massage the data.
    if (children.length > 0 || aggregates.length > 0) {
      queryResults = queryResults.reduce((newResults, result) => {
        newResults.push(result);

        // Aggregates are soql functions that aggregate data, like "SELECT avg(total)" and
        // are returned in the data as exprX. Aggregates can have aliases, like "avg(total) totalAverage"
        // and are returned in the data as the alias.
        if (aggregates.length > 0) {
          for (let i = 0; i < aggregates.length; i++) {
            const aggregate = aggregates[i];
            if (!aggregate.alias) {
              result[aggregate.name] = result[`expr${i}`];
            }
          }
        }

        if (children.length > 0) {
          const childrenRows = {};
          children.forEach(child => {
            childrenRows[child] = result[child];
            delete result[child];
          });

          _.keys(childrenRows).forEach(child => {
            if (childrenRows[child]) {
              childrenRows[child].records.forEach(record => {
                const newRecord = {};
                _.each(record, (value, key) => {
                  newRecord[`${child}.${key}`] = value;
                });
                newResults.push(newRecord);
              });
            }
          });
        }
        return newResults;
      }, []);
    }
    return queryResults;
  }
  onFinished(queryResults) {
    const { attributeNames, children, aggregates } = this.parseFields();
    let totalCount = queryResults.length;

    this.display(attributeNames, this.massageRows(queryResults, children, aggregates), totalCount);

    return super.onFinished(queryResults);
  }
  display(attributeNames, queryResults, totalCount) {
    Display.soqlQuery(attributeNames, queryResults, totalCount);
  }
  getFormat() {
    return 'txt';
  }
}

const SEPARATOR: string = ',';
const DOUBLE_QUOTE: string = '"';
const SHOULD_QUOTE_REGEXP: RegExp = new RegExp(`[${SEPARATOR}${DOUBLE_QUOTE}${EOL}]`);

export class CsvReporter extends QueryReporter {
  /**
   * Escape a value to be placed in a CSV row. We follow rfc 4180
   * https://tools.ietf.org/html/rfc4180#section-2 and will not surround the
   * value in quotes if it doesn't contain the separator, double quote, or EOL.
   * @param value The escaped value
   */
  escape(value) {
    if (value && _.isFunction(value.match) && value.match(SHOULD_QUOTE_REGEXP)) {
      return `"${value.replace(/"/gi, '""')}"`;
    }
    return value;
  }
  onFinished(queryResults) {
    const fields = this.columns;
    const hasSubqueries = _.some(fields, field => field instanceof SubqueryField);
    const hasFunctions = _.some(fields, field => field instanceof FunctionField);

    let attributeNames = [];

    if (fields) {
      this.logger.info(`Found fields ${JSON.stringify(fields.map(field => `${typeof field}.${field.name}`))}`);
    } else {
      this.logger.info(`No fields found for query "${this.query}"`);
    }

    if (hasSubqueries || hasFunctions) {
      // If there are subqueries, we need to get the max child length for each subquery.
      const typeLengths = {};
      // For function fields, like avg(total).
      const aggregates = [];

      fields.forEach(field => {
        if (field instanceof SubqueryField) {
          typeLengths[field.name] = 0;
        }
        if (field instanceof FunctionField) {
          aggregates.push(field);
        }
      });

      // Get max lengths by iterating over the records once
      queryResults.forEach(result => {
        _.keys(typeLengths).forEach(key => {
          if (result[key] && result[key].totalSize > typeLengths[key]) {
            typeLengths[key] = result[key].totalSize;
          }
        });

        // Aggregates are soql functions that aggregate data, like "SELECT avg(total)" and
        // are returned in the data as exprX. Aggregates can have aliases, like "avg(total) totalAverage"
        // and are returned in the data as the alias.
        if (aggregates.length > 0) {
          for (let i = 0; i < aggregates.length; i++) {
            const aggregate = aggregates[i];
            if (!aggregate.alias) {
              result[aggregate.name] = result[`expr${i}`];
            }
          }
        }
      });

      fields.forEach(field => {
        if (typeLengths[field.name]) {
          for (let i = 0; i < typeLengths[field.name]; i++) {
            attributeNames.push(`${field.name}.totalSize`);
            (field as SubqueryField).fields.forEach(subfield => {
              attributeNames.push(`${field.name}.records.${i}.${subfield.name}`);
            });
          }
        } else if (field instanceof FunctionField) {
          if (field.alias) {
            attributeNames.push(field.alias);
          } else {
            attributeNames.push(field.name);
          }
        } else {
          attributeNames.push(field.name);
        }
      });
    } else {
      attributeNames = fields.map(field => field.name);
    }

    this.log(
      attributeNames
        .map(name => {
          return this.escape(name);
        })
        .join(SEPARATOR)
    );

    queryResults.forEach(row => {
      const values = attributeNames.map(name => {
        return this.escape(_.get(row, name));
      });
      this.log(values.join(SEPARATOR));
    });

    return super.onFinished(queryResults);
  }
  getFormat() {
    return 'csv';
  }
}

export class JsonReporter extends QueryReporter {
  onFinished(queryResults) {
    // We can only log to streams because the CLI process logs the json to stdout.
    this.logToStreams(JSON.stringify(queryResults));
    return super.onFinished(queryResults);
  }
  log(msg) {}
  logTable(header, data, columns) {}
  getFormat() {
    return 'json';
  }
}

/**
 * A list of the accepted reporter types
 */
export const FormatTypes = {
  human: HumanReporter,
  csv: CsvReporter,
  json: JsonReporter
};

export class DataSoqlQueryCommand {
  validate(context) {
    if (context.flags.json) {
      context.flags.resultformat = 'json';
    } else if (context.flags.resultformat === 'json') {
      // If the result format is json, make sure the context is too
      context.flags.json = true;
    }
    return context;
  }

  async execute(context): Promise<any> {
    context.ux.startSpinner('Querying Data');
    const logger = context.logger;
    const resultFormat = context.flags.resultformat || 'human';

    if (!FormatTypes[resultFormat]) {
      context.ux.stopSpinner();
      throw Error(Messages.get('DataSOQLQueryInvalidReporter', Object.keys(FormatTypes)));
    }

    if (context.flags.query) {
      let conn = await Config.getActiveConnection(context);

      if (context.flags.usetoolingapi) {
        conn = conn.tooling as any;
      }
      // Reporter requires a legacy logapi type
      const reporter = new FormatTypes[resultFormat](conn, context.flags.query, logger);
      return await conn.query(context.flags.query, undefined, async function(
        err: Errorable,
        result: QueryResult<object>
      ) {
        context.ux.stopSpinner();
        return await handleResults(conn, err, result, reporter);
      });
    } else {
      context.ux.stopSpinner();
      throw Error(context.command);
    }
  }
}

let handleResults = async function(
  conn: Connection,
  err: Errorable,
  result: QueryResult<object>,
  reporter: QueryReporter
): Promise<QueryResult<object>> {
  if (err) {
    throw Error(err.message);
  }

  if (result.records && result.records.length > 0) {
    await reporter.retrieveColumns();

    // get all result batches
    let moreResults: QueryResult<object> = result;
    while (!moreResults.done) {
      if (moreResults.nextRecordsUrl) {
        moreResults = await conn.queryMore(moreResults.nextRecordsUrl);
        if (moreResults.records) {
          result.records = result.records.concat(moreResults.records);
        } else {
          throw Error(Messages.get('DataSOQLQueryMoreMissingRecords'));
        }
      } else {
        throw Error(Messages.get('DataSOQLQueryMoreMissingUrl'));
      }
    }
    if (result.records) {
      reporter.emit('finished', result.records);
    } else {
      throw Error(Messages.get('DataSOQLQueryMoreMissingRecords'));
    }
  } else if (!(reporter instanceof JsonReporter)) {
    Display.info(Messages.get('DataSOQLQueryNoResults'));
  }

  // Clean result for consumer
  delete result.nextRecordsUrl;
  result.done = true;
  return result;
};

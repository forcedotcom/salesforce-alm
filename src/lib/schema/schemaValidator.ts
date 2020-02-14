/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholely superceded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import * as path from 'path';
import * as BBPromise from 'bluebird';
import * as validator from 'jsen';
import * as almError from '../core/almError';
import srcDevUtil = require('../core/srcDevUtil');

const { readJSON } = srcDevUtil;
const SCHEMAS_DIR = path.join(__dirname, '..', '..', '..', 'schemas');

/**
 * Load another schema in the schemas directory when referenced. This method is
 * called by ajv when a $ref is used on a reference that isn't found in the same
 * schema.
 *
 * TODO Handle url:// references, otherwise it is a local schema
 *
 * @param {string} uri The first segment of the $ref schema
 * @param {function} callback The callback when the external schema is loaded
 */
const loadExternalSchemas = uri => {
  const schemaPath = path.join(SCHEMAS_DIR, `${uri}.json`);

  return readJSON(schemaPath).catch(err => {
    if (err.code === 'ENOENT') {
      // No need for messages, as this is a developer error and caught by a unit test
      throw new Error('SCHEMA NOT FOUND');
    }
    throw err;
  });
};

/**
 * Get a string representation of the ajv schema validation errors
 *
 * @param {array} errors An array of ajv error objects. Usually obtained by validator.errors
 */
const errorsText = (errors, schema) =>
  errors
    .map(error => {
      const property = error.path.match(/^([a-zA-Z0-9\.]+)\.([a-zA-Z0-9]+)$/);

      const getPropValue = prop =>
        error.path
          .split('.')
          .reduce(
            (obj, name) =>
              (obj.properties && obj.properties[name]) || (name === '0' && obj.items) || obj[name] || obj[prop],
            schema
          );

      const getEnumValues = () => {
        const enumSchema = getPropValue('enum');
        return enumSchema && enumSchema.enum ? enumSchema.enum.join(', ') : '';
      };

      switch (error.keyword) {
        case 'additionalProperties':
          return `${error.path} should NOT have additional properties '${error.additionalProperties}'}`;
        case 'required':
          if (property) {
            return `${property[1]} should have required property ${property[2]}`;
          }
          return `should have required property '${error.path}'`;
        case 'oneOf':
          // TODO Could probably be a better message
          return `${error.path} should match exactly one schema in oneOf`;
        case 'enum':
          return `${error.path} should be equal to one of the allowed values ${getEnumValues()}`;
        case 'type': {
          const _path = error.path === '' ? 'Root of JSON object' : error.path;
          return `${_path} is an invalid type.  Expected type [${getPropValue('type')}]`;
        }
        default:
          return `${error.path} invalid ${error.keyword}`;
      }
    })
    .join('\n');

class SchemaValidator {
  // TODO: proper property typing
  [property: string]: any;

  constructor(logger, schemaPath?) {
    this.schemaPath = schemaPath;
    this.logger = logger.child('SchemaValidator');
  }

  /**
   * Load the schema from the SCHEMA_FILE path. We do not store the schema
   * data for memory so it must be used right after the promise returns.
   *
   * @returns {BBPromise} The schema
   */
  loadSchema() {
    return readJSON(this.schemaPath).then(data => {
      this.logger.debug(`Schema loaded for ${this.schemaPath}`);
      return data;
    });
  }

  validate(data) {
    return this.loadSchema()
      .then(schema => {
        // Load all external schemas
        let refs = JSON.stringify(schema).match(/"\$ref"\s*:\s*"([\w\.]+)#[\w/]*"/g);

        if (refs) {
          refs = refs.map(ref => ref.match(/"([\w\.]+)#/)[1]);

          return BBPromise.all(refs.map(ref => loadExternalSchemas(ref))).then(externalSchemas => {
            const externalSchemasMap = {};
            externalSchemas.forEach(externalSchema => {
              externalSchemasMap[externalSchema.id] = externalSchema;
            });
            return [schema, externalSchemasMap];
          });
        }

        return [schema, {}];
      })
      .then(([schema, externalSchemas]) => {
        // TODO We should default to throw an error when a property is specified
        // that is not in the schema, the only option to do this right now is
        // to specify "removeAdditional: false" in every object.
        const validate = validator(schema, {
          greedy: true,
          schemas: externalSchemas
        });

        const valid = validate(data);

        if (!valid) {
          if (validate.errors) {
            throw almError('ValidationSchemaFieldErrors', `Validation errors:\n${errorsText(validate.errors, schema)}`);
          } else {
            throw almError('ValidationSchemaUnknown');
          }
        }
        return validate.build(data);
      });
  }
}

export = SchemaValidator;

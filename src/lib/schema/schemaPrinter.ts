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

import logger = require('../core/logApi');

class Schema {
  constructor(rawSchema) {
    Object.assign(this, rawSchema);
  }

  /**
   * Get the referenced definition by following the reference path on the
   * current schema. TODO: allow following external schemas.
   *
   * @prop {object} prop The property that contains the $ref field.
   */
  getReferenceDefinition(prop) {
    let definition = prop;
    const segments = prop.$ref.split('/');

    segments.forEach(segment => {
      if (segment === '#') {
        definition = this;
      } else {
        definition = definition[segment];
      }
    });

    return definition;
  }
}

class SchemaProperty {
  // TODO: proper property typing
  [property: string]: any;

  constructor(schema, name, prop) {
    this.schema = schema;
    this.name = name;

    // Shorthands for used terminal styles
    this.bold = logger.color.bold;
    this.dim = logger.color.dim;
    this.underline = logger.color.underline;

    // Apply the referenced definition
    if (prop.$ref) {
      Object.assign(this, schema.getReferenceDefinition(prop));
    }

    // Add the original property's properties to 'this'. If they are defined here,
    // they take precedence over referenced definition properties.
    Object.assign(this, prop);

    // Handle oneOfs
    if (this.oneOf) {
      // TODO Should this be = 'oneOf' and we show the different options below?
      this.type = this.type || this.oneOf.map(oneOf => oneOf.type || oneOf.$ref).join('|');
    }

    // Handle items references
    if (this.items && this.items.$ref) {
      Object.assign(this.items, schema.getReferenceDefinition(this.items));
    }
  }

  getName() {
    return this.bold(this.name);
  }

  getTitle() {
    return this.underline(this.title);
  }

  getDescription() {
    return this.dim(this.description);
  }

  getType() {
    return this.dim(this.type);
  }

  getHeader() {
    return `${this.getName()}(${this.getType()}) - ${this.getTitle()}: ${this.getDescription()}`;
  }

  getArrayHeader() {
    const minItems = this.minItems ? ` - min ${this.minItems}` : '';
    const prop = new SchemaProperty(this.schema, 'items', this.items);
    return `items(${prop.getType()}${minItems}) - ${prop.getTitle()}: ${prop.getDescription()}`;
  }
}

class SchemaPrinter {
  // TODO: proper property typing
  [property: string]: any;

  constructor(rawSchema) {
    this.schema = new Schema(rawSchema);
    this.lines = [];

    if (!this.schema.properties && !this.schema.items) {
      // No need to add to messages, since this should never happen. In fact,
      // this will cause a test failure if there is a command that uses a schema
      // with no properties defined.
      throw new Error('There is no purpose to print a schema with no properties or items');
    }

    const startLevel = 0;
    const add = this.addFn(startLevel);

    // For object schemas, print out the "header" and first level properties differently
    if (this.schema.properties) {
      if (this.schema.description) {
        // Output the overall schema description before printing the properties
        add(this.schema.description);
        add('');
      }

      Object.keys(this.schema.properties).forEach(key => {
        this.parseProp(key, this.schema.properties[key], startLevel);
        add('');
      });
    } else {
      this.parseProp('schema', this.schema, startLevel);
    }
  }

  print() {
    this.lines.forEach(line => logger.log(line));
  }

  addFn(level) {
    const indent = ' '.repeat(level * 4);
    return line => {
      this.lines.push(`${indent}${line}`);
    };
  }

  parseProp(name, prop, level) {
    const add = this.addFn(level);

    prop = new SchemaProperty(this.schema, name, prop);

    add(prop.getHeader());

    if (prop.type === 'object' && prop.properties) {
      Object.keys(prop.properties).forEach(key => {
        this.parseProp(key, prop.properties[key], level + 1);
      });
    }
    if (prop.type === 'array') {
      add(`    ${prop.getArrayHeader()}`);
      if (prop.items.type === 'object') {
        if (prop.items.properties) {
          Object.keys(prop.items.properties).forEach(key => {
            this.parseProp(key, prop.items.properties[key], level + 2);
          });
        }
        if (prop.items.patternProperties) {
          Object.keys(prop.items.patternProperties).forEach(key => {
            add(`${key} : ${prop.items.patternProperties[key].pattern}`);
          });
        }
      }
    }
    if (prop.required) {
      add(`Required: ${prop.required.join(', ')}`);
    }
  }
}

export = SchemaPrinter;

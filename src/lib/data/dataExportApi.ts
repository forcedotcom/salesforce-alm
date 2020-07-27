/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Thirdparty
import * as path from 'path';
import * as BBPromise from 'bluebird';
import * as _ from 'lodash';

// Node
const fs = BBPromise.promisifyAll(require('fs'));

const mkdirp = BBPromise.promisify(require('mkdirp'));

// Local
import logApi = require('../core/logApi');
import * as almError from '../core/almError';
import srcDevUtil = require('../core/srcDevUtil');
import { Dictionary } from '@salesforce/ts-types';
import messages = require('../messages');

const DATA_PLAN_FILENAME_PART = '-plan.json';

const describe = {}; // holds metadata result for object type describe calls

/**
 * Command that provides data export capabilities.
 */
class DataExportApi {
  // TODO: proper property typing
  [property: string]: any;

  constructor(org) {
    this.org = org;
    this.force = org.force;
    this.logger = logApi.child('data-export', { username: org.getName() });

    this.objectTypeRegistry = {}; // registry for object type data plan descriptor
    this.referenceRegistry = {}; // registry of object type-specific id-to-ref mappings
    this.typeRefIndexes = {}; // registry for object type-specific ref counters
  }

  /**
   * Validates the flags (options) set on the command.  Ensures the -q (--query) flag
   * is specified, which can be either a soql query or a file containing a soql query.
   *
   * @param options - The flags on the context passed to the command.
   * @returns BBPromise.<Object>
   */
  validate(context: Dictionary<any> = {}) {
    const options = context.flags;
    // query option required
    if (!options.query) {
      throw almError('dataExportSoqlNotProvided');
    }

    const filepath = path.resolve(process.cwd(), options.query);
    if (fs.existsSync(filepath)) {
      options.query = fs.readFileSync(filepath, 'utf8');

      if (!options.query) {
        throw almError('dataExportSoqlNotProvided');
      }
    }

    options.query = options.query.toLowerCase().trim();
    if (!_.startsWith(options.query, 'select')) {
      throw almError('dataExportInvalidSoql', options.query);
    }

    return BBPromise.resolve(context);
  }

  /**
   * Invokes given SOQL query against given target Org.  Results
   * are converted into SObject Tree format.
   *
   * @param options
   */
  execute(options: Dictionary<any> = {}) {
    return this.validate(options)
      .then(() => this._setupOutputDirectory(options))
      .then(() => {
        console.log('about to force query');

        this.force.query(this.org, options.query);
      })
      .then(recordList => {
        console.log('after force query');

        this._main(options, recordList);
      })
      .then(sobjectTree => {
        console.log('checking records');

        if (!sobjectTree.records.length) {
          return sobjectTree;
        }
        if (options.plan) {
          return this._generateDataPlan(options, sobjectTree);
        } else {
          const fileName = `${Object.keys(this.objectTypeRegistry).join('-')}.json`;
          return this._writeFile(options, fileName, sobjectTree);
        }
      })
      .catch(e => {
        if (e.name === 'MALFORMED_QUERY') {
          throw almError('dataExportQueryMalformed', [e.message], 'dataExportQueryMalformedAction');
        } else {
          throw e;
        }
      });
  }

  //   P R I V A T E   M E T H O D S

  _setupOutputDirectory(options) {
    if (options.outputdir) {
      return mkdirp(options.outputdir)
        .then(() => options.outputdir)
        .catch(error => {
          // It is ok if the directory already exist
          if (error.name !== 'EEXIST') {
            throw error;
          }
        });
    }
    return BBPromise.resolve();
  }

  // Process query results generating SObject Tree format
  _main(options, recordList) {
    return this._recordObjectTypes(recordList)
      .then(() => {
        console.log('process the records');

        this._processRecordList(options, recordList);
      })
      .then(processedRecordList => {
        // log record count; warn if > 200 and !options.plan
        const recordCount = _.get(processedRecordList, 'records.length');
        this.logger.info(messages().getMessage('dataExportRecordCount', [recordCount, options.query]));
        if (recordCount > 200 && !options.plan) {
          this.logger.warn(messages().getMessage('dataExportRecordCountWarning', [recordCount, options.query]));
        }
        return this._finalApplyRefs(processedRecordList.records);
      });
  }

  // Register object types and type hierarchy for plan generation
  _recordObjectTypes(recordList) {
    console.log('register object types');

    const records = recordList.records;

    if (!records.length) {
      this.logger.log('Query returned no results');
      return BBPromise.resolve(recordList);
    }

    // top level object type
    this.objectTypeRegistry[records[0].attributes.type] = {
      order: 0,
      type: records[0].attributes.type,
      saveRefs: true, // post-save, record reference-to-id to be used for child reference resolution
      resolveRefs: false // pre-save, don't resolve relationship references to parent ids (from previous save)
    };

    records.forEach(record => {
      Object.keys(record).map(key => {
        const value = record[key];
        if (value && _.get(value, 'records.length')) {
          const firstRec = value.records[0];
          const type = _.get(firstRec, 'attributes.type');
          // found a related object, add to map
          if (type && !this.objectTypeRegistry[type]) {
            this.objectTypeRegistry[type] = {
              order: 1,
              type,
              saveRefs: false, // assume child records will not be parents (may be changed later)
              resolveRefs: true // resolve relationship references to parent ids
            };
          }
        }

        return key;
      });
    });

    // pre-load object metadata
    const promises = Object.keys(this.objectTypeRegistry).map(key => this._loadMetadata(key));
    return BBPromise.all(promises).then(() => recordList);
  }

  _processRecordList(options, recordList, parentRef?) {
    // holds transformed sobject tree
    const sobjectTree = { records: [] };

    // visit each record in the list
    const processRecordsFn = record => () => this._processRecords(options, parentRef, record, sobjectTree);
    const recordFns = recordList.records.map(record => processRecordsFn(record));

    return srcDevUtil.sequentialExecute(recordFns).then(() => {
      this.logger.info(JSON.stringify(sobjectTree, null, 4));
      return sobjectTree;
    });
  }

  _processRecords(options, parentRef, record, sobjectTree) {
    // incremented every time we visit another record
    const objRefId = this._incrementTypeRefIndex(record.attributes.type);

    // add the attributes for this record, setting the type and reference
    const treeRecord = {
      attributes: {
        type: record.attributes.type,
        referenceId: objRefId
      }
    };

    // store the reference in a map with the record id
    this._saveRecordRef(record, objRefId);

    // handle each record attribute
    return this._processRecordAttributes(options, record, treeRecord, objRefId).then(() => {
      if (parentRef && options.plan) {
        if (!treeRecord[parentRef.fieldName]) {
          treeRecord[parentRef.fieldName] = parentRef.id;
        }
      }

      // add record to tree
      sobjectTree.records.push(treeRecord);

      return BBPromise.resolve(sobjectTree);
    });
  }

  // Generate object type reference (<ObjectType>Ref<Counter>)
  _incrementTypeRefIndex(type) {
    if (!this.typeRefIndexes[type]) {
      this.typeRefIndexes[type] = 0;
    }

    return `${type}Ref${++this.typeRefIndexes[type]}`;
  }

  _processRecordAttributes(options, record, treeRecord, objRefId) {
    const promises = Object.keys(record).map(key =>
      this._processRecordAttribute(options, record, key, treeRecord, objRefId)
    );

    return BBPromise.all(promises).then(() => treeRecord);
  }

  _processRecordAttribute(options, record, key, treeRecord, objRefId) {
    return BBPromise.resolve().then(() => {
      const field = record[key];

      // skip attributes and id.  Data import does not accept records with IDs.
      if (key === 'attributes' || key === 'Id') {
        // If this is an attributes section then we need to add an object reference
        this._saveRecordRef(record, objRefId);
      } else {
        return this._loadMetadata(record.attributes.type)
          .then(metadata => {
            if (this._isQueryResult(metadata, key)) {
              if (!field) {
                // The parent has no child records, so return an empty records array
                return { records: [] };
              }
              // handle child records
              return this._loadMetadata(field.records[0].attributes.type).then(childMetadata =>
                this._processRecordList(options, field, {
                  id: `@${objRefId}`,
                  fieldName: this._getRelationshipFieldName(childMetadata, record.attributes.type)
                })
              );
            } else {
              // see if this is a relationship field
              if (this._isRelationshipWithMetadata(metadata, key)) {
                // related to which field?
                const relTo = this._getRelatedToWithMetadata(metadata, key);
                if (options.plan) {
                  // find reference in record result
                  if (this.objectTypeRegistry[relTo]) {
                    // add ref to replace the value
                    const id = record[key];
                    const relatedObject = this.referenceRegistry[relTo];
                    if (relatedObject) {
                      const ref = relatedObject[id];
                      // If ref is not found, then leave intact because we may not have processed
                      // this parent fully. We'll go back through the sObject tree
                      // later and replace the id with a reference.
                      return ref ? `@${ref}` : id;
                    } else {
                      // again, this will just be the id for now and replaced with a ref later.
                      return id;
                    }
                  } else {
                    // TODO: what to do if ref not found?
                    this.logger.error(`Reference ${relTo} not found for ${key}.  Skipping record ${record['Id']}.`);
                  }
                }
              } else {
                // not a relationship field, simple key/value insertion
                return record[key];
              }
            }

            return null;
          })
          .then(processedAttribute => {
            if (processedAttribute !== null) {
              treeRecord[key] = processedAttribute;
            }

            return BBPromise.resolve(null);
          })
          .catch(e => {
            throw e;
          });
      }

      return BBPromise.resolve(null);
    });
  }

  // Call and store force.describe() result for given object type
  _loadMetadata(objectName) {
    if (!describe[objectName]) {
      return this.force.describe(this.org, objectName).then(result => {
        describe[objectName] = result;
        return describe[objectName];
      });
    }

    return BBPromise.resolve(describe[objectName]);
  }

  _isQueryResult(metadata, fieldName) {
    return metadata.childRelationships.some(cr => cr.relationshipName === fieldName);
  }

  _isSpecificTypeWithMetadata(metadata, fieldName, fieldType) {
    for (let i = 0, fld; i < metadata.fields.length; i++) {
      fld = metadata.fields[i];
      if (fld.name.toLowerCase() === fieldName.toLowerCase()) {
        if (fld.type.toLowerCase() === fieldType.toLowerCase()) {
          return true;
        }
      }
    }

    return false;
  }

  _getRelationshipFieldName(metadata, parentName) {
    let result;
    metadata.fields.some(field => {
      if (field.type === 'reference') {
        for (let i = 0; i < field.referenceTo.length; i++) {
          if (field.referenceTo[i] === parentName) {
            result = field.name;
            return true;
          }
        }
      }

      return false;
    });

    if (!result) {
      throw new Error(`Unable to find relationship field name for ${metadata.name}`);
    }

    return result;
  }

  _isRelationship(objectName, fieldName) {
    const metadata = describe[objectName];
    if (!metadata) {
      throw new Error(`Metadata not found for ${objectName}`);
    }

    return this._isRelationshipWithMetadata(metadata, fieldName);
  }

  _isRelationshipWithMetadata(metadata, fieldName) {
    return this._isSpecificTypeWithMetadata(metadata, fieldName, 'reference');
  }

  _getRelatedTo(objectName, fieldName) {
    const metadata = describe[objectName];
    if (!metadata) {
      throw new Error(`Metadata not found for ${objectName}`);
    }

    return this._getRelatedToWithMetadata(metadata, fieldName);
  }

  _getRelatedToWithMetadata(metadata, fieldName) {
    let result;
    metadata.fields.some(field => {
      if (field.name === fieldName) {
        for (let i = 0; i < field.referenceTo.length; i++) {
          result = field.referenceTo[i];
          return true;
        }
      }

      return false;
    });

    if (!result) {
      throw new Error(`Unable to find relation for ${metadata.Name}`);
    }

    return result;
  }

  // Register object type's id to reference mapping
  _saveRecordRef(obj, refId) {
    const id = path.basename(obj.attributes.url);
    const ref = refId;

    if (typeof this.referenceRegistry[obj.attributes.type] === 'undefined') {
      this.referenceRegistry[obj.attributes.type] = {};
    }

    // ensure no existing reference
    if (this.referenceRegistry[obj.attributes.type][id] && this.referenceRegistry[obj.attributes.type][id] !== ref) {
      throw new Error(
        `Overriding ${obj.attributes.type} reference for ${id}: existing ${
          this.referenceRegistry[obj.attributes.type][id]
        }, incoming ${ref}`
      );
    }

    this.referenceRegistry[obj.attributes.type][id] = ref;
  }

  /**
   * Walk the final data set and split out into files.  The main queried
   * object is the parent, and has a different saveRefs and resolveRefs
   * values.  All the references have been created at this point.
   */
  _generateDataPlan(options, sobjectTree) {
    const objects = {};
    const dataPlan = [];
    let topLevelObjectType;

    // loop thru object tree extracting type-specific records into separate tree structure
    sobjectTree.records.forEach(record => {
      topLevelObjectType = record.attributes.type;
      if (!objects[topLevelObjectType]) {
        objects[topLevelObjectType] = { records: [] };
      }

      Object.keys(record).map(key => {
        const childRecords = _.get(record, `${key}.records`);
        if (childRecords) {
          // found child records, add to type-specific registry
          if (childRecords.length) {
            const childObjectType = childRecords[0].attributes.type;
            if (!objects[childObjectType]) {
              objects[childObjectType] = { records: [] };
            }

            childRecords.forEach(child => {
              objects[childObjectType].records.push(child);
            });
          }

          // remove child from top-level object structure
          delete record[key];
        }

        return key;
      });

      objects[topLevelObjectType].records.push(record);
    });

    // sort object types based on insertion dependence
    const objectsSorted = Object.keys(this.objectTypeRegistry).sort(
      (a, b) => this.objectTypeRegistry[a].order - this.objectTypeRegistry[b].order
    );
    const writeDataFileFns = [];
    const writeDataFileFn = key => () =>
      this._writeObjectTypeDataFile(
        options,
        key,
        this.objectTypeRegistry[key].saveRefs,
        this.objectTypeRegistry[key].resolveRefs,
        `${key}s.json`,
        objects[key]
      ).then(dataPlanPart => {
        dataPlan.push(dataPlanPart);
      });

    objectsSorted.forEach(key => {
      writeDataFileFns.push(writeDataFileFn(key));
    });

    // write data plan file
    const dataPlanFile = Object.keys(this.objectTypeRegistry).join('-') + DATA_PLAN_FILENAME_PART;
    return srcDevUtil.sequentialExecute(writeDataFileFns).then(() => this._writeFile(options, dataPlanFile, dataPlan));
  }

  // generate data plan stanza referencing written object type file
  _writeObjectTypeDataFile(options, type, saveRefs, resolveRefs, fileName, sObject) {
    let _filename = fileName;
    if (options.prefix) {
      _filename = `${options.prefix}-${fileName}`;
    }
    const dataPlanPart = {
      sobject: type,
      saveRefs,
      resolveRefs,
      files: [_filename]
    };

    return this._writeFile(options, fileName, sObject).then(() => dataPlanPart);
  }

  /**
   * This method is used as a second pass to establish references that couldn't be determined
   * in the initial pass done by processRecordList. It looks for relationship fields that
   * contain an id.
   */
  _finalApplyRefs(sobjectTree) {
    sobjectTree.forEach(record => {
      Object.keys(record).map(field => {
        if (record[field].records) {
          // These are children
          this._finalApplyRefs(record[field].records);
        } else {
          const objType = record.attributes.type;

          if (this._isRelationship(objType, field)) {
            const id = record[field].toString();
            if (!id.startsWith('@')) {
              const refTo = this._getRelatedTo(objType, field);
              const ref = this.referenceRegistry[refTo][id];

              if (!ref) {
                throw new Error(`${objType} reference to ${refTo} (${id}) not found in query results.`);
              }

              record[field] = `@${ref}`;

              // Setup dependency ordering for later output
              if (this.objectTypeRegistry[objType].order <= this.objectTypeRegistry[refTo].order) {
                this.objectTypeRegistry[objType].order = this.objectTypeRegistry[refTo].order + 1;
                this.objectTypeRegistry[refTo].saveRefs = true;
                this.objectTypeRegistry[objType].resolveRefs = true;
              }
            }
          }
        }

        return field;
      });
    });

    return BBPromise.resolve({ records: sobjectTree });
  }

  _countRecords(obj) {
    return _.reduce(
      obj,
      (acc, records) => {
        acc += records.length;
        records.forEach(record => {
          _.each(record, val => {
            if (val && val.records) {
              acc += this._countRecords(val);
            }
          });
        });
        return acc;
      },
      0
    );
  }

  _writeFile(options, fileName, jsonObject) {
    let recordCount = 0;
    if (options.prefix) {
      fileName = `${options.prefix}-${fileName}`;
    }

    if (options.outputdir) {
      fileName = path.join(options.outputdir, fileName);
    }

    if (_.get(jsonObject, 'records')) {
      recordCount = this._countRecords(jsonObject);
    }

    return fs.writeFileAsync(fileName, JSON.stringify(jsonObject, null, 4)).then(() => {
      this.logger.log(`Wrote ${recordCount} records to ${fileName}`);
      return jsonObject;
    });
  }
}

export = DataExportApi;

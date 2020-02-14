/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';
import * as BBPromise from 'bluebird';

import Org = require('../core/scratchOrgApi');
import Messages = require('../messages');
const messages = Messages();
import logger = require('../core/logApi');
import OrgDecorator = require('./orgHighlighter');
import ShapeRepApi = require('./shapeRepApi');

const EMPTY_STRING = '';

/**
 * Command impl for force:org:shape:list
 */
class OrgShapeListCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('OrgShapeListCommand');
    this.orgDecorator = new OrgDecorator(this.logger);
  }

  execute() {
    const sortAndDecorateFunc = val => {
      const sortVal = val.username;
      this.orgDecorator.decorateStatus(val);
      return [val.alias, sortVal];
    };

    return (
      Org.readAllUserFilenames()
        .then(fileNames => Org.readLocallyValidatedMetaConfigsGroupedByOrgType(fileNames, 3, null))

        // filter the non-scratch orgs that can be connected-to
        .then(metaConfigs => {
          const reachableOrgs = [];

          metaConfigs.nonScratchOrgs.forEach(orgMeta => {
            this.logger.info(`Checking org: ${orgMeta.username} with status: ${orgMeta.connectedStatus}`);
            if (orgMeta.connectedStatus && orgMeta.connectedStatus === 'Connected') {
              reachableOrgs.push(orgMeta);
            }
          });

          return reachableOrgs;
        })

        // find Orgs with ShapeRepresentations
        .then(reachableOrgs => {
          const shapes = [];
          const allOrgs = BBPromise.map(
            reachableOrgs,
            orgMeta => {
              // need an Org to make sobject query
              this.logger.info(`Query org: ${orgMeta.username} for shapes`);
              const shapeOrg = Org.create(orgMeta.username);
              return shapeOrg.then(org =>
                org.getConfig().then(() => {
                  // query all shape representations for an org
                  const shapeApi = new ShapeRepApi(null, org);
                  const query = shapeApi.findShapesOrNull();
                  return query.then(queryResult => {
                    if (!_.isNil(queryResult)) {
                      return { shapeMeta: orgMeta, result: queryResult };
                    }
                    return null;
                  });
                })
              );
            },
            { concurrency: 1 }
          )
            .catch(err => {
              this.logger.error(false, 'Error finding org shapes', err);
              throw err;
            })

            // accummulate shape representations, merge attributes from the shape org
            .then(results => {
              results.forEach(r => {
                if (!_.isNil(r)) {
                  // process all ShapeRepresentation records for this org
                  _.forEach(r.result.records, shape => {
                    const meta = r.shapeMeta;
                    const orgShape = {
                      orgId: meta.orgId,
                      username: meta.username,
                      alias: meta.alias,
                      shapeId: shape.Id,
                      status: shape.Status,
                      createdBy: shape.CreatedBy.Username,
                      createdDate: shape.CreatedDate
                    };
                    shapes.push(orgShape);
                  });
                }
              });
            });

          // resolve shape orgs to find all shape representations
          return BBPromise.join(allOrgs, () => shapes);
        })

        .then(shapes => {
          this.logger.styledHeader(this.logger.color.blue('Org Shapes'));
          return shapes;
        })

        .then(shapes => ({ orgShapes: _.sortBy(shapes, sortAndDecorateFunc) }))
    );
  }

  validate(context) {
    return BBPromise.resolve(context.flags);
  }

  getHumanErrorMessage() {
    return EMPTY_STRING;
  }

  getHumanSuccessMessage() {
    return EMPTY_STRING;
  }

  getEmptyResultMessage(key) {
    if (key === 'orgShapes') {
      return messages.getMessage('noOrgShapes', null, 'org_shape_list');
    }
    return null;
  }

  getColumnData() {
    // default columns for the shape list
    const orgShapeColumns = [
      { key: 'defaultMarker', label: '' },
      { key: 'alias', label: 'ALIAS' },
      { key: 'username', label: 'USERNAME' },
      { key: 'orgId', label: 'ORG ID' },
      { key: 'status', label: 'SHAPE STATUS' },
      { key: 'createdBy', label: 'CREATED BY' },
      { key: 'createdDate', label: 'CREATED DATE' }
    ];

    return {
      orgShapes: orgShapeColumns
    };
  }
}
export = OrgShapeListCommand;

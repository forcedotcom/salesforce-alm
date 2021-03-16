/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Certain Org Features require a translation or should be deprecated.
 * Encapsulates feature mappings and deprecated features.
 */
// P R I V A T E

// Third Party
import * as _ from 'lodash';
// Local
import Messages = require('../messages');
const messages = Messages();

import { isString } from '@salesforce/ts-types';

const FEATURE_TYPES = {
  //simpleFeatureMapping holds a set of direct replacement values for features.
  simpleFeatureMapping: {
    SALESWAVE: ['DEVELOPMENTWAVE'],
    SERVICEWAVE: ['DEVELOPMENTWAVE']
  },
  quantifiedFeatureMapping: {},
  deprecatedFeatures: [
    'EXPANDEDSOURCETRACKING',
    'LISTCUSTOMSETTINGCREATION',
    'AppNavCapabilities',
    'EditInSubtab',
    'OldNewRecordFlowConsole',
    'OldNewRecordFlowStd',
    'DesktopLayoutStandardOff',
    'SplitViewOnStandardOff',
    'PopOutUtilities'
  ]
};

interface FeatureTypes {
  simpleFeatureMapping: { [key: string]: string[] };
  quantifiedFeatureMapping: object;
  deprecatedFeatures: string[];
}

export class ScratchOrgFeatureDeprecation {
  private featureTypes: FeatureTypes;
  //Allow override for testing.
  constructor(options: FeatureTypes = FEATURE_TYPES) {
    this.featureTypes = options;
    this.featureTypes.deprecatedFeatures = this.featureTypes.deprecatedFeatures.map(v => _.toUpper(v));
    //Make all of the keys in simpleFeatureMapping upper case.
    let sfm = {};
    Object.keys(this.featureTypes.simpleFeatureMapping).forEach(key => {
      sfm[_.toUpper(key)] = this.featureTypes.simpleFeatureMapping[key];
    });
    this.featureTypes.simpleFeatureMapping = sfm;
  }

  /**
   * Gets list of feature warnings that should be logged
   * @param features The requested features.
   * @returns List of string feature warnings.
   */
  getFeatureWarnings(features: string | string[]): string[] {
    /* Get warning messages for deprecated features and feature mappings.*/
    const featureWarningMessages: string[] = [];
    if (features) {
      const requestedFeatures = _.toUpper(isString(features) ? features : features.join(';'));

      /* If a public quantified feature is defined without a quantity, throw a warning.*/
      Object.keys(this.featureTypes.quantifiedFeatureMapping).forEach(key => {
        if (new RegExp(`${key};|${key},|${key}$`, 'i').test(requestedFeatures)) {
          featureWarningMessages.push(
            messages.getMessage(
              'quantifiedFeatureWithoutQuantityWarning',
              [key, this.featureTypes.quantifiedFeatureMapping[key]],
              'signup'
            )
          );
        }
      });
      /* If a simply mapped feature is defined, log a warning.*/
      Object.keys(this.featureTypes.simpleFeatureMapping).forEach(key => {
        if (new RegExp(`${key};|${key},|${key}$`, 'i').test(requestedFeatures)) {
          featureWarningMessages.push(
            messages.getMessage(
              'mappedFeatureWarning',
              [key, '[' + this.featureTypes.simpleFeatureMapping[key].map(v => "'" + v + "'").join(',') + ']'],
              'signup'
            )
          );
        }
      });
      /* If a deprecated feature is identified as deprecated, throw a warning.*/
      this.featureTypes.deprecatedFeatures.forEach(deprecatedFeature => {
        if (requestedFeatures.includes(deprecatedFeature)) {
          featureWarningMessages.push(messages.getMessage('deprecatedFeatureWarning', deprecatedFeature, 'signup'));
        }
      });
    }
    return featureWarningMessages;
  }

  /**
   * Removes all deprecated features for the organization.
   * @param features List of features to filter
   * @returns feature array with proper mapping.
   */
  filterDeprecatedFeatures(features: string[]): string[] {
    const _features: string[] = [];
    features.forEach(feature => {
      let _feature = _.toUpper(feature);
      /* If deprecated feature is specified, remove feature from the request. */
      if (this.featureTypes.deprecatedFeatures.includes(_feature)) {
        return;
      } else if (this.featureTypes.simpleFeatureMapping[_feature]) {
        /* If a simply mapped feature is specified, then perform the mapping.  */
        this.featureTypes.simpleFeatureMapping[_feature].forEach(f => {
          _features.push(f);
        });
      } else {
        /** Nothing special about this feature */
        _features.push(feature);
      }
    });
    return _features;
  }
}

/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as fs from 'fs-extra';
import * as os from 'os';
import * as util from 'util';
import * as path from 'path';

// Thirdparty
import * as BBPromise from 'bluebird';
import * as _ from 'lodash';
import * as mkdirp from 'mkdirp';
const js2xmlparser = require('js2xmlparser');
import { UX } from '@salesforce/command';
import OrgPrefRegistry = require('./orgPrefRegistry');
import { Messages } from '@salesforce/core';
import { Config } from '../../lib/core/configApi';

Messages.importMessagesDirectory(__dirname);
const orgSettingsMessages = Messages.loadMessages('salesforce-alm', 'org_settings');

BBPromise.promisifyAll(fs);

/** This is the contents of the package.xml that we will use when we deploy settings to a scratch org. */
const _settingsPackageFileContents =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Package xmlns="http://soap.sforce.com/2006/04/metadata">' +
  '    <types>' +
  '%s' +
  '        <name>Settings</name>' +
  '    </types>' +
  '    <version>%s</version>' +
  '</Package>';

/**
 * Helper class for dealing with the settings that are defined in a scratch definition file.  This class knows how to extract the
 * settings from the definition, how to expand them into a MD directory and how to generate a package.xml.
 */
class SettingsGenerator {
  private settingData;
  private currentApiVersion = new Config().getApiVersion();

  /** extract the settings from the scratch def file, if they are present. */
  async extract(scratchDef,apiVersion?): Promise<void> {

    if (util.isNullOrUndefined(apiVersion)) {
       apiVersion = this.currentApiVersion;
    }
    if ((apiVersion >= 47.0) && (this.orgPreferenceSettingsMigrationRequired(scratchDef))) {
      await this.extractAndMigrateSettings(scratchDef);
    } else {
      this.settingData = _.get(scratchDef, 'settings');
    }

    // TODO, this is where we will validate the settings.
    // See W-5068155
    // if (this.hasSettings()) { }

  }

  /** True if we are currently tracking setting data. */
  hasSettings() {
    return !_.isEmpty(this.settingData);
  }

  /** Check to see if the scratchDef contains orgPreferenceSettings 
   *  orgPreferenceSettings are no longer supported after api version 46.0 
   */
  orgPreferenceSettingsMigrationRequired(scratchDef) {
    return !((util.isNullOrUndefined(scratchDef)) ||
        (util.isNullOrUndefined(scratchDef.settings)) ||
        (util.isNullOrUndefined(scratchDef.settings.orgPreferenceSettings)));
  }

  /** This will copy all of the settings in the scratchOrgInfo orgPreferences mapping into the settings structure.
   *  It will also spit out a warning about the pending deprecation og the orgPreferences structure. 
   *  This returns a failure message in the promise upon critical error for api versions after 46.0.
   *  For api versions less than 47.0 it will return a warning.
   */
  async migrate(scratchDef,apiVersion): Promise<void> {

    //Make sure we have old style preferences
    if (!scratchDef.orgPreferences) return;

    if (util.isNullOrUndefined(apiVersion)) {
      apiVersion =  this.currentApiVersion;
    }

    //First, let's map the old style tooling preferences into MD-API preferences
    this.settingData = {};

    const ux = await UX.create();

    function lhccmdt(mdt) { // lowercase head camel case metadata type
        return (util.isNullOrUndefined(mdt)) ? mdt : mdt.substring(0,1).toLowerCase()+mdt.substring(1);
    }

    function storePrefs(data, pref, prefVal) {
      const orgPrefApi = lhccmdt(OrgPrefRegistry.whichApi(pref,apiVersion));

      if (util.isNullOrUndefined(orgPrefApi)) {
        ux.warn(`Unsupported org preference: ${pref}, ignored`);
        return;
      }

      const mdApiName = lhccmdt(OrgPrefRegistry.forMdApi(pref,apiVersion));
      if (!_.has(data, orgPrefApi)) {
        _.set(data, orgPrefApi, {});
      }
      const apiOrgPrefs = _.get(data, orgPrefApi);
      _.set(apiOrgPrefs, mdApiName, prefVal);
    }

    if (scratchDef.orgPreferences.enabled) {
      scratchDef.orgPreferences.enabled.forEach(pref => {
        storePrefs(this.settingData, pref, true);
      });
    }
    if (scratchDef.orgPreferences.disabled) {
      scratchDef.orgPreferences.disabled.forEach(pref => {
        storePrefs(this.settingData, pref, false);
      });
    }
    // It would be nice if cli.ux.styledJSON could return a colorized JSON string instead of logging to stdout.
    const message = orgSettingsMessages.getMessage((apiVersion >= 47.0) ? 'deprecatedPrefFormat' : 'deprecatedPrefFormatLegacy' ,
      [JSON.stringify({orgPreferences: scratchDef.orgPreferences }, null, 4),
        JSON.stringify({settings: this.settingData}, null, 4)]);
    if (apiVersion >= 47.0) {
      return Promise.reject(new Error(message));
    } else {
      ux.warn(message);
    }
    //No longer need these
    delete scratchDef.orgPreferences;
  }

  /** This method converts all orgPreferenceSettings preferences into their respective
   *  org settings objects.
   */
  async extractAndMigrateSettings(scratchDef): Promise<void> {

    const oldScratchDef =  JSON.stringify({ 'settings' : scratchDef.settings }, null, 4);

    //Make sure we have old style preferences
    if (!this.orgPreferenceSettingsMigrationRequired(scratchDef)) {
      this.settingData = _.get(scratchDef, 'settings');
      return;
    }
    //First, let's map the old style tooling preferences into MD-API preferences
    this.settingData = {};

    const ux = await UX.create();
    function storePrefs(data, pref, prefVal) : boolean {
      var mdApiName = OrgPrefRegistry.newPrefNameForOrgSettingsMigration(pref);
      if (util.isNullOrUndefined(mdApiName)) {
        mdApiName = pref;
      }
      var orgPrefApi = OrgPrefRegistry.whichApiFromFinalPrefName(mdApiName);
      if (util.isNullOrUndefined(orgPrefApi)) {
        ux.warn(`Unknown org preference: ${pref}, ignored.`);
        return false;
      }

      if (OrgPrefRegistry.isMigrationDeprecated(orgPrefApi)) {
        ux.warn(`The setting "${pref}" is no longer supported as of API version 47.0`);
        return false;
      }

      if (!_.has(data, orgPrefApi)) {
        _.set(data, orgPrefApi, {});
      }
      const apiOrgPrefs = _.get(data, orgPrefApi);

      // check to see if the value is already set
      _.set(apiOrgPrefs, mdApiName, prefVal);
      
      return orgPrefApi != OrgPrefRegistry.ORG_PREFERENCE_SETTINGS;
    }

    var orgPreferenceSettings = _.get(scratchDef, 'settings.orgPreferenceSettings');
    delete scratchDef.settings.orgPreferenceSettings;
    this.settingData = _.get(scratchDef, 'settings');

    var migrated = false;
    for (var preference in orgPreferenceSettings) {
      if (storePrefs(this.settingData, preference, orgPreferenceSettings[preference])) {
        migrated = true;
      }
    }

    //Since we could have recommended some preferences that are still in OPS, only warn if any actually got moved there
    if (migrated ) {
      // It would be nice if cli.ux.styledJSON could return a colorized JSON string instead of logging to stdout.
      const message = orgSettingsMessages.getMessage('migratedPrefFormat',
        [oldScratchDef,
        JSON.stringify({settings: this.settingData}, null, 4)]);
      ux.warn(message);
    }
  }

  /** Create temporary deploy directory used to upload the scratch org shape.
   * This will create the dir, generate package.xml and all of the .setting files.
   * @returns {BBPromise<string>} The temporary deployment destination directory.
   */
  public async createDeployDir(apiVersion): BBPromise<string> {
    // The root of our package; use SFDX_MDAPI_TEMP_DIR if set.
    const targetDir = process.env.SFDX_MDAPI_TEMP_DIR || os.tmpdir();
    const destRoot = path.join(targetDir, 'shape');
    const settingsDir = path.join(destRoot, 'settings');
    const packageFile = path.join(destRoot, 'package.xml');
    return (
      fs
        .exists(destRoot)
        // Create a deploy directory
        .then(present => {
          if (present) {
            fs.removeSync(destRoot);
          }
          return mkdirp.sync(settingsDir);
        })
        // Generate all .settings files into our temporary deploy directory for each JSON setting
        .then(() => {
          const files = [];
          Object.keys(this.settingData).forEach(item => {
            const value = _.get(this.settingData, item);
            const typeName = this.cap(item);
            const fname = typeName.replace('Settings', '');
            const f = this._createSettingsFileContent(typeName, value);
            files.push(fs.writeFile(path.join(settingsDir, fname + '.settings'), f));
          });
          return BBPromise.all(files);
        })
        // Create our package.xml file in the settings root
        .then(() => {
          let memberReferences = '';
          Object.keys(this.settingData).forEach(item => {
            const typeName = this.cap(item).replace('Settings', '');
            memberReferences += '<members>' + typeName + '</members>';
          });
          return fs.writeFile(packageFile, util.format(_settingsPackageFileContents, memberReferences, apiVersion));
        })
        .then(() => destRoot)
    );
  }

  _createSettingsFileContent(name, json) {
    if (name == `OrgPreferenceSettings`) {
      //this is a stupid format
      let res =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<OrgPreferenceSettings xmlns="http://soap.sforce.com/2006/04/metadata">\n';
      Object.keys(json).forEach(pref => {
        res += '\t<preferences>\n';
        res += '\t\t<settingName>' + this.cap(pref) + '</settingName>\n';
        res += '\t\t<settingValue>' + _.get(json, pref) + '</settingValue>\n';
        res += '\t</preferences>\n';
      });
      res += '</OrgPreferenceSettings>';
      return res;
    } else {
      return js2xmlparser.parse(name, json);
    }
  }
  cap(s) {
    return s.charAt(0).toUpperCase() + s.substring(1);
  }
}

export = SettingsGenerator;

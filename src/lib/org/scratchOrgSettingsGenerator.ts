/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as os from 'os';
import * as util from 'util';
import * as path from 'path';

// Thirdparty

const js2xmlparser = require('js2xmlparser');
import { UX } from '@salesforce/command';
import OrgPrefRegistry = require('./orgPrefRegistry');
import { Messages, fs } from '@salesforce/core';
import { has } from 'lodash';
import { get, getObject, getString } from '@salesforce/ts-types';
import { set, isEmpty } from '@salesforce/kit';
import { Config } from '../../lib/core/configApi';

Messages.importMessagesDirectory(__dirname);
const orgSettingsMessages: Messages = Messages.loadMessages('salesforce-alm', 'org_settings');

/** This is the contents of the package.xml that we will use when we deploy settings to a scratch org. */

const _packageFileContents: string = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
%s
    <version>%s</version>
</Package>`;

/** This is the contents for a single section for a particular metadata type in the package.xml.  */
const _packageFileTypeSection = `    <types>
        %s
        <name>%s</name>
    </types>
`;

/**
 * Helper class for dealing with the settings that are defined in a scratch definition file.  This class knows how to extract the
 * settings from the definition, how to expand them into a MD directory and how to generate a package.xml.
 */
class SettingsGenerator {
  private settingData: object;
  private objectSettingsData: object;
  private currentApiVersion = new Config().getApiVersion();

  /** extract the settings from the scratch def file, if they are present. */
  async extract(scratchDef, apiVersion?): Promise<void> {
    if (util.isNullOrUndefined(apiVersion)) {
      apiVersion = this.currentApiVersion;
    }
    if (apiVersion >= 47.0 && this.orgPreferenceSettingsMigrationRequired(scratchDef)) {
      await this.extractAndMigrateSettings(scratchDef);
    } else {
      this.settingData = getObject(scratchDef, 'settings');
      this.objectSettingsData = getObject(scratchDef, 'objectSettings');
    }

    // TODO, this is where we will validate the settings.
    // See W-5068155
    // if (this.hasSettings()) {  }
  }

  /** True if we are currently tracking setting or object setting data. */
  hasSettings() {
    return !(isEmpty(this.settingData) && isEmpty(this.objectSettingsData));
  }

  /** Check to see if the scratchDef contains orgPreferenceSettings
   *  orgPreferenceSettings are no longer supported after api version 46.0
   */
  orgPreferenceSettingsMigrationRequired(scratchDef) {
    return !(
      util.isNullOrUndefined(scratchDef) ||
      util.isNullOrUndefined(scratchDef.settings) ||
      util.isNullOrUndefined(scratchDef.settings.orgPreferenceSettings)
    );
  }

  /** This will copy all of the settings in the scratchOrgInfo orgPreferences mapping into the settings structure.
   *  It will also spit out a warning about the pending deprecation og the orgPreferences structure.
   *  This returns a failure message in the promise upon critical error for api versions after 46.0.
   *  For api versions less than 47.0 it will return a warning.
   */
  async migrate(scratchDef, apiVersion): Promise<void> {
    //Make sure we have old style preferences
    if (!scratchDef.orgPreferences) return;

    if (util.isNullOrUndefined(apiVersion)) {
      apiVersion = this.currentApiVersion;
    }

    //First, let's map the old style tooling preferences into MD-API preferences
    this.settingData = {};

    const ux = await UX.create();

    function lhccmdt(mdt) {
      // lowercase head camel case metadata type
      return util.isNullOrUndefined(mdt) ? mdt : mdt.substring(0, 1).toLowerCase() + mdt.substring(1);
    }

    function storePrefs(data, pref, prefVal) {
      const orgPrefApi = lhccmdt(OrgPrefRegistry.whichApi(pref, apiVersion));
      if (util.isNullOrUndefined(orgPrefApi)) {
        ux.warn(`Unsupported org preference: ${pref}, ignored`);
        return;
      }

      const mdApiName = lhccmdt(OrgPrefRegistry.forMdApi(pref, apiVersion));

      if (!has(data, orgPrefApi)) {
        set(data, orgPrefApi, {});
      }
      const apiOrgPrefs: object = getObject(data, orgPrefApi);
      set(apiOrgPrefs, mdApiName, prefVal);
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
    const message = orgSettingsMessages.getMessage(
      apiVersion >= 47.0 ? 'deprecatedPrefFormat' : 'deprecatedPrefFormatLegacy',
      [
        JSON.stringify({ orgPreferences: scratchDef.orgPreferences }, null, 4),
        JSON.stringify({ settings: this.settingData }, null, 4)
      ]
    );
    if (apiVersion >= 47.0) {
      throw new Error(message);
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
    const oldScratchDef = JSON.stringify({ settings: scratchDef.settings }, null, 4);

    //Make sure we have old style preferences
    if (!this.orgPreferenceSettingsMigrationRequired(scratchDef)) {
      this.settingData = getObject(scratchDef, 'settings');
      return;
    }
    //First, let's map the old style tooling preferences into MD-API preferences
    this.settingData = {};

    const ux = await UX.create();
    function storePrefs(data, pref, prefVal): boolean {
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

      if (!has(data, orgPrefApi)) {
        set(data, orgPrefApi, {});
      }
      const apiOrgPrefs = getObject(data, orgPrefApi);

      // check to see if the value is already set
      set(apiOrgPrefs, mdApiName, prefVal);

      return orgPrefApi != OrgPrefRegistry.ORG_PREFERENCE_SETTINGS;
    }

    var orgPreferenceSettings = getObject(scratchDef, 'settings.orgPreferenceSettings');
    delete scratchDef.settings.orgPreferenceSettings;
    this.settingData = getObject(scratchDef, 'settings');

    var migrated = false;
    for (var preference in orgPreferenceSettings) {
      if (storePrefs(this.settingData, preference, orgPreferenceSettings[preference])) {
        migrated = true;
      }
    }

    //Since we could have recommended some preferences that are still in OPS, only warn if any actually got moved there
    if (migrated) {
      // It would be nice if cli.ux.styledJSON could return a colorized JSON string instead of logging to stdout.
      const message = orgSettingsMessages.getMessage('migratedPrefFormat', [
        oldScratchDef,
        JSON.stringify({ settings: this.settingData }, null, 4)
      ]);
      ux.warn(message);
    }
  }

  /** Create temporary deploy directory used to upload the scratch org shape.
   * This will create the dir, generate package.xml and all of the .setting files.
   */
  public async createDeployDir(apiVersion) {
    // The root of our package; use SFDX_MDAPI_TEMP_DIR if set.
    const targetDir = process.env.SFDX_MDAPI_TEMP_DIR || os.tmpdir();
    const destRoot = path.join(targetDir, 'shape');
    const settingsDir = path.join(destRoot, 'settings');
    const objectsDir = path.join(destRoot, 'objects');
    const packageFilePath = path.join(destRoot, 'package.xml');
    let allRecTypes: string[] = [];
    let allBps: string[] = [];
    try {
      await fs.access(destRoot, fs.constants.F_OK);
      await fs.rmdir(destRoot);
    } catch (e) {
      // If access failed, the root dir probably doesn't exist, so we're fine
    }

    await Promise.all([
      this.writeSettingsIfNeeded(settingsDir),
      this.writeObjectSettingsIfNeeded(objectsDir, allRecTypes, allBps)
    ]);

    await this.writePackageFile(allRecTypes, allBps, packageFilePath, apiVersion);
    return destRoot;
  }

  private async writePackageFile(allRecTypes: string[], allBps: string[], packageFilePath: string, apiVersion: any) {
    let packageContentInternals = '';
    let settingsMemberReferences = '';
    if (this.settingData) {
      Object.keys(this.settingData).forEach(item => {
        const typeName = this.cap(item).replace('Settings', '');
        settingsMemberReferences += '\n        <members>' + typeName + '</members>';
      });
      packageContentInternals += util.format(_packageFileTypeSection, settingsMemberReferences, 'Settings');
    }
    let objectMemberReferences = '';
    if (this.objectSettingsData) {
      Object.keys(this.objectSettingsData).forEach(item => {
        objectMemberReferences += '\n        <members>' + this.cap(item) + '</members>';
      });
      packageContentInternals += util.format(_packageFileTypeSection, objectMemberReferences, 'CustomObject');
      packageContentInternals += this.getTypeReferences(allRecTypes, 'RecordType');
      packageContentInternals += this.getTypeReferences(allBps, 'BusinessProcess');
    }
    await fs.writeFile(packageFilePath, util.format(_packageFileContents, packageContentInternals, apiVersion));
  }

  private async writeObjectSettingsIfNeeded(objectsDir: string, allRecTypes: string[], allBps: string[]) {
    if (this.objectSettingsData) {
      await fs.mkdirp(objectsDir);
      for (const item of Object.keys(this.objectSettingsData)) {
        const value: object = getObject(this.objectSettingsData, item);
        const fileContent = this._createObjectFileContent(this.cap(item), value, allRecTypes, allBps);
        await fs.writeFile(path.join(objectsDir, this.cap(item) + '.object'), fileContent);
      }
    }
  }

  private async writeSettingsIfNeeded(settingsDir: string) {
    if (this.settingData) {
      await fs.mkdirp(settingsDir);
      for (const item of Object.keys(this.settingData)) {
        const value: object = getObject(this.settingData, item);
        const typeName = this.cap(item);
        const fname = typeName.replace('Settings', '');
        const fileContent = this._createSettingsFileContent(typeName, value);
        await fs.writeFile(path.join(settingsDir, fname + '.settings'), fileContent);
      }
    }
  }

  private getTypeReferences(componentNames: string[], componentType: string) {
    return componentNames && componentNames.length > 0
      ? util.format(
          _packageFileTypeSection,
          componentNames.map(item => '\n    <members>' + item + '</members>').join(''),
          componentType
        )
      : '';
  }

  _createSettingsFileContent(name, json) {
    if (name == `OrgPreferenceSettings`) {
      //this is a stupid format
      let res = `<?xml version="1.0" encoding="UTF-8"?>
<OrgPreferenceSettings xmlns="http://soap.sforce.com/2006/04/metadata">
`;
      res += Object.keys(json)
        .map(
          pref =>
            `    <preferences>
        <settingName>` +
            this.cap(pref) +
            `</settingName>
        <settingValue>` +
            get(json, pref) +
            `</settingValue>
    </preferences>`
        )
        .join('\n');
      res += '\n</OrgPreferenceSettings>';
      return res;
    } else {
      return js2xmlparser.parse(name, json);
    }
  }

  _createObjectFileContent(name: string, json: Object, allRecTypes: String[], allBps: String[]) {
    //name already capped
    let res = `<?xml version="1.0" encoding="UTF-8"?>
<Object xmlns="http://soap.sforce.com/2006/04/metadata">
`;
    let sharingModel = getString(json, 'sharingModel');
    if (sharingModel) {
      res += '    <sharingModel>' + this.cap(sharingModel) + '</sharingModel>\n';
    }

    let defaultRecordType = getString(json, 'defaultRecordType');
    if (defaultRecordType) {
      // We need to keep track of these globally for when we generate the package XML.
      allRecTypes.push(name + '.' + this.cap(defaultRecordType));
      let bpName = null;
      let bpPicklistVal = null;
      // These four objects require any record type to specify a "business process"--
      // a restricted set of items from a standard picklist on the object.
      if (['Case', 'Lead', 'Opportunity', 'Solution'].includes(name)) {
        bpName = this.cap(defaultRecordType) + 'Process';
        switch (name) {
          case 'Case':
            bpPicklistVal = 'New';
            break;
          case 'Lead':
            bpPicklistVal = 'New - Not Contacted';
            break;
          case 'Opportunity':
            bpPicklistVal = 'Prospecting';
            break;
          case 'Solution':
            bpPicklistVal = 'Draft';
        }
      }
      // Create the record type

      res +=
        `    <recordTypes>
        <fullName>` +
        this.cap(defaultRecordType) +
        `</fullName>
        <label>` +
        this.cap(defaultRecordType) +
        `</label>
        <active>true</active>
`;
      if (bpName) {
        //We need to keep track of these globally for the package.xml
        allBps.push(name + '.' + bpName);
        res += '        <businessProcess>' + bpName + '</businessProcess>\n';
      }
      res += '    </recordTypes>\n';
      // If required, create the business processes they refer to
      if (bpName) {
        res +=
          `    <businessProcesses>
        <fullName>` +
          bpName +
          `</fullName>
        <isActive>true</isActive>
        <values>
            <fullName>` +
          bpPicklistVal +
          `</fullName>
            <default>true</default>
        </values>
    </businessProcesses>
`;
      }
    }
    res += '</Object>';
    return res;
  }

  cap(s: string) {
    return s ? (s.length > 0 ? s.charAt(0).toUpperCase() + s.substring(1) : '') : null;
  }
}

export = SettingsGenerator;

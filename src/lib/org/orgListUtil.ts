import * as BBPromise from 'bluebird';
import * as _ from 'lodash';
import * as moment from 'moment';

import { Org, AuthInfo, sfdc, ConfigAggregator, Global, AuthFields, Logger } from '@salesforce/core';
import { basename, join } from 'path';
import Alias = require('../core/alias');
import { Dictionary, JsonMap } from '@salesforce/ts-types';
import { statSync } from 'fs';
import { Record } from 'jsforce';

export interface ExtendedAuthFields extends AuthFields {
  lastUsed: Date;
  orgName?: string;
  edition?: string;
  signupUsername?: string;
  devHubOrgId?: string;
  isExpired?: boolean;
  connectedStatus?: string;
  status?: string;
  isDefaultUsername?: boolean;
  isDefaultDevHubUsername?: boolean;
  createdBy: string;
  createdDate: string;
  attributes: object;
}

type OrgGroups = {
  nonScratchOrgs: ExtendedAuthFields[];
  activeScratchOrgs: ExtendedAuthFields[];
  expiredScratchOrgs: ExtendedAuthFields[];
  queryExpirationDate: ExtendedAuthFields[];
  totalScratchOrgs: ExtendedAuthFields[];
};

type ScratchOrgInfo = {
  Id: string;
  SignupUsername: string;
  ExpirationDate: string;
};

type ExtendedScratchOrgInfo = ScratchOrgInfo & {
  devHubOrgId: string;
  connectedStatus: string;
};

export class OrgListUtil {
  static logger;

  static _accum: OrgGroups = {
    nonScratchOrgs: [],
    activeScratchOrgs: [],
    expiredScratchOrgs: [],
    queryExpirationDate: [],
    totalScratchOrgs: []
  };

  public static async retrieveLogger() {
    if (!OrgListUtil.logger) {
      OrgListUtil.logger = await Logger.child('OrgListUtil');
    }
    return OrgListUtil.logger;
  }

  /**
   * This method takes all locally configured orgs and organizes them into the following buckets:
   * { activeScratchOrgs: [{}], nonScratchOrgs: [{}], scratchOrgs: [{}] }
   * the scratchOrgInfo query.
   * @param {string[]|null} excludeProperties - properties to exclude from the configs defaults. ['refreshToken', 'clientSecret']. Specify null to include all properties.
   * @param {string[]|null} userFilenames- an array of strings that are validated against the server.
   */
  public static async readLocallyValidatedMetaConfigsGroupedByOrgType(
    userFilenames: string[],
    flags,
    excludeProperties?: string[]
  ): Promise<OrgGroups> {
    const contents: AuthInfo[] = await this.readAuthFiles(userFilenames);

    const authInfos: Dictionary<AuthInfo> = contents.reduce((map, content) => {
      if (content) {
        map[content.getUsername()] = content;
      }
      return map;
    }, {});

    const orgs = await this._groupOrgs(contents, this._accum, excludeProperties);

    /** Retrieve scratch org info for scratch orgs that do not have exp date in their auth files */
    await Promise.all(
      orgs.queryExpirationDate.map(async fields => {
        if (fields.devHubUsername) {
          try {
            const devHugOrg = await Org.create({ aliasOrUsername: fields.devHubUsername });
            const authInfo = authInfos[fields.username];
            if (authInfo) {
              await this.retrieveScratchOrgExpDate(devHugOrg, sfdc.trimTo15(fields.orgId), authInfo);
            }
          } catch (err) {
            // Throwing an error will cause the comand to exit with the error. We just want the exp date information of all orgs.
          }
        }
      })
    );

    const allScratchOrgs = orgs.activeScratchOrgs.concat(orgs.expiredScratchOrgs);
    orgs.totalScratchOrgs = allScratchOrgs;

    /** Ensure addtional fields have been added to the scratchOrg info */
    if (flags.verbose || flags.json) {
      let orgIdsToQuery: Dictionary<string[]> = {};
      const orgsToQuery = flags.all ? orgs.totalScratchOrgs : orgs.activeScratchOrgs;
      orgsToQuery.forEach(fields => {
        if (fields.devHubUsername) {
          if (!orgIdsToQuery[fields.devHubUsername]) {
            orgIdsToQuery[fields.devHubUsername] = [];
          }
          orgIdsToQuery[fields.devHubUsername].push(sfdc.trimTo15(fields.orgId));
        }
      });

      let updatedContents = (
        await Promise.all(
          Object.entries(orgIdsToQuery).map(async ([username, orgIds]) => {
            const data = await this.retrieveScratchOrgInfoFromDevHub(username, orgIds);
            return data;
          })
        )
      ).reduce((list, contents) => [...list, ...contents], []);

      const resultOrgInfo = await this.reduceScratchOrgInfo(updatedContents, orgsToQuery);
      if (flags.all) {
        orgs.totalScratchOrgs = resultOrgInfo;
      } else {
        orgs.activeScratchOrgs = resultOrgInfo;
      }
    }

    if (flags.skipconnectionstatus) {
      return orgs;
    } else {
      await BBPromise.map(orgs.nonScratchOrgs, (fields: ExtendedAuthFields) => {
        // attempt to get the connection status of the devhub
        return this.determineDevHubConnStatus(fields);
      });
      return orgs;
    }
  }

  /**
   * Used to retrieve authInfo of the auth files
   * @param fileNames All the filenames in the global hidden folder
   */
  static async readAuthFiles(fileNames: string[]): Promise<AuthInfo[]> {
    const allAuths: AuthInfo[] = await Promise.all(
      fileNames.map(async fileName => {
        try {
          let orgUsername = basename(fileName, '.json');
          return AuthInfo.create({ username: orgUsername });
        } catch (err) {
          const logger = await OrgListUtil.retrieveLogger();
          logger.warn(`Problem reading file: ${fileName} skipping`);
          logger.warn(err.message);
        }
      })
    );
    return allAuths.filter(authInfo => !!authInfo);
  }

  /**
   * retrieves the connection info of an nonscratch org
   * @returns {BBPromise.<array>}
   */
  static async determineDevHubConnStatus(fields: ExtendedAuthFields) {
    try {
      const org = await Org.create({ aliasOrUsername: fields.username });

      // Do the query for orgs without a devHubUsername attribute. In some cases scratch org auth
      // files may not have a devHubUsername property; but that's ok. We will discover it before this.
      const devHubUsername = org.getField(Org.Fields.DEV_HUB_USERNAME);
      if (!devHubUsername) {
        try {
          await org.refreshAuth();
          fields.connectedStatus = 'Connected';
        } catch (error) {
          const logger = await OrgListUtil.retrieveLogger();
          logger.trace(`error refreshing auth for org: ${org.getUsername()}`);
          logger.trace(error);
          fields.connectedStatus = error['code'] || error.message;
        }
      }
      // Don't do anything if it isn't devhub
    } catch (e) {
      fields.connectedStatus = 'Unknown';
    }
  }

  /**
   * Helper to group orgs by {activeScratchOrgs, scratchOrg, nonScratchOrgs}
   * @param {object} contents -The authinfo retrieved from the auth files
   * @param {string[]} excludeProperties - properties to exclude from the grouped configs ex. ['refreshToken', 'clientSecret']
   * @private
   */
  static async _groupOrgs(authInfos: AuthInfo[], _accum: OrgGroups, excludeProperties?: string[]): Promise<OrgGroups> {
    const config = (await ConfigAggregator.create()).getConfig();

    for (const authInfo of authInfos) {
      const fields = authInfo.getFields();
      const currentValue = OrgListUtil._removeRestrictedInfoFromConfig(fields, excludeProperties) as ExtendedAuthFields;

      currentValue.alias = await Alias.byValue(fields.username);
      currentValue.lastUsed = statSync(join(Global.DIR, `${fields.username}.json`)).atime;

      this.identifyDefaultOrgs(currentValue, config);
      if (currentValue.devHubUsername) {
        if (!currentValue.expirationDate) {
          _accum['queryExpirationDate'].push(currentValue);
        } else if (OrgListUtil._identifyActiveOrgs(currentValue.expirationDate)) {
          currentValue.status = 'Active';
          currentValue.isExpired = false;
          _accum['activeScratchOrgs'].push(currentValue);
        } else {
          currentValue.status = 'Expired';
          currentValue.isExpired = true;
          _accum['expiredScratchOrgs'].push(currentValue);
        }
      } else {
        _accum['nonScratchOrgs'].push(currentValue);
      }
    }
    return _accum;
  }

  static async retrieveScratchOrgExpDate(devHub: Org, orgId: string, authInfo: AuthInfo) {
    const _fields = ['ExpirationDate'];
    const conn = devHub.getConnection();
    const object = await conn.sobject('ScratchOrgInfo').find<ScratchOrgInfo>({ ScratchOrg: orgId }, _fields);

    if (object.length > 0) {
      // There should only be one.
      await this.writeFieldsToAuthFile(object[0], authInfo);
    }
  }

  static async writeFieldsToAuthFile(scratchOrgInfo: ScratchOrgInfo, authInfo: AuthInfo, excludeProperties?: string[]) {
    let authInfoFields = authInfo.getFields() as ExtendedAuthFields;

    if (!authInfoFields['ExpirationDate']) {
      await authInfo.save({ expirationDate: scratchOrgInfo.ExpirationDate });

      authInfoFields = OrgListUtil._removeRestrictedInfoFromConfig(
        authInfoFields,
        excludeProperties
      ) as ExtendedAuthFields;
      authInfoFields.alias = await Alias.byValue(authInfoFields.username);
      authInfoFields.lastUsed = statSync(join(Global.DIR, `${authInfoFields.username}.json`)).atime;

      if (this._identifyActiveOrgs(authInfoFields.expirationDate)) {
        authInfoFields['status'] = 'Active';
        authInfoFields.isExpired = false;
        this._accum.activeScratchOrgs.push(authInfoFields);
      } else {
        authInfoFields['status'] = 'Expired';
        authInfoFields.isExpired = true;
        this._accum.expiredScratchOrgs.push(authInfoFields);
      }
    }
  }

  /**
   * Helper utility to remove sensitive information from a scratch org auth config. By default refreshTokens and client secrets are removed.
   * @param {*} config - scratch org auth object.
   * @param {string[]} properties - properties to exclude ex ['refreshToken', 'clientSecret']
   * @returns the config less the sensitive information.
   */
  static _removeRestrictedInfoFromConfig(config: AuthFields, properties = ['refreshToken', 'clientSecret']) {
    return _.omit(config, properties);
  }

  /**
   * Helper to identify active orgs based on the expiration data.
   * @param expirationDate
   */
  static _identifyActiveOrgs(expirationDate) {
    return moment(expirationDate).isAfter(moment());
  }

  /**Identify the default orgs */
  private static identifyDefaultOrgs(orgInfo: ExtendedAuthFields, config: JsonMap) {
    const defaultUsername = config.defaultusername;
    const defaultDevhubUsername = config.defaultdevhubusername;

    if (orgInfo.username === defaultUsername || orgInfo.alias === defaultUsername) {
      orgInfo.isDefaultUsername = true;
    } else if (orgInfo.username === defaultDevhubUsername || orgInfo.alias === defaultDevhubUsername) {
      orgInfo.isDefaultDevHubUsername = true;
    }
  }

  static async retrieveScratchOrgInfoFromDevHub(
    username: string,
    orgIdsToQuery: string[]
  ): Promise<Record<ExtendedScratchOrgInfo>[]> {
    const _fields = ['OrgName', 'CreatedBy.Username', 'CreatedDate', 'Edition', 'SignupUsername'];

    try {
      const devHubOrg = await Org.create({ aliasOrUsername: username });
      const conn = devHubOrg.getConnection();
      const data = await conn
        .sobject('ScratchOrgInfo')
        .find<ExtendedScratchOrgInfo>({ ScratchOrg: { $in: orgIdsToQuery } }, _fields);
      data.map(org => {
        org.devHubOrgId = devHubOrg.getOrgId();
        /** For orgs that are not dev hubs, we need not return a connectedStatus */
        org.connectedStatus = 'Unknown';
        return org;
      });
      return data;
    } catch (err) {
      return [];
    }
  }

  static async reduceScratchOrgInfo(updatedContents: Record<ExtendedScratchOrgInfo>[], orgs: ExtendedAuthFields[]) {
    /** Reduce the information to key value pairs with signupUsername as key */
    const contentMap = updatedContents.reduce((map, scratchOrgInfo) => {
      if (!!scratchOrgInfo) {
        map[scratchOrgInfo.SignupUsername] = scratchOrgInfo;
      }
      return map;
    }, {});

    for (const scratchOrgInfo of orgs) {
      const updatedOrgInfo = contentMap[scratchOrgInfo.username];
      if (updatedOrgInfo) {
        scratchOrgInfo.signupUsername = updatedOrgInfo.SignupUsername;
        scratchOrgInfo.createdBy = updatedOrgInfo.CreatedBy.Username;
        scratchOrgInfo.createdDate = updatedOrgInfo.CreatedDate;
        scratchOrgInfo.devHubOrgId = updatedOrgInfo.devHubOrgId;
        scratchOrgInfo.attributes = updatedOrgInfo.attributes;
        scratchOrgInfo.orgName = updatedOrgInfo.OrgName;
        scratchOrgInfo.edition = updatedOrgInfo.Edition;
        scratchOrgInfo.connectedStatus = updatedOrgInfo.connectedStatus;
      } else {
        const logger = await OrgListUtil.retrieveLogger();
        logger.warn(`Can't find ${scratchOrgInfo.username} in the updated contents`);
      }
    }
    return orgs;
  }
}

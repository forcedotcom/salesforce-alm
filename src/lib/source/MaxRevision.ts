import { SourceMember } from './SourceMember';
import { ConfigContents, ConfigFile, Connection, fs, Logger, Org, SfdxError } from '@salesforce/core';
import { Dictionary, Optional, getNumber } from '@salesforce/ts-types';
import { Duration, sleep } from '@salesforce/kit';
import * as path from 'path';
import { join as pathJoin } from 'path';
import MetadataRegistry = require('./metadataRegistry');

type MemberRevision = {
  serverRevisionCounter: number;
  lastRetrievedFromServer: number;
  memberType: string;
  isNameObsolete: boolean;
};

type MaxJson = ConfigContents & {
  serverMaxRevisionCounter: number;
  sourceMembers: Dictionary<MemberRevision>;
};

export namespace MaxRevision {
  // Constructor Options for MaxRevision.
  export interface Options extends ConfigFile.Options {
    username: string;
  }
}

const QUERY_MAX_REVISION_COUNTER = 'SELECT MAX(RevisionCounter) MaxRev FROM SourceMember';

/**
 * This file is in charge of writing and reading to/from the .sfdx/orgs/<username>/maxRevision.json file for each scratch
 * org. This file is a json that keeps track of a SourceMember object and the serverMaxRevisionCounter, which is the
 * highest RevisionCounter field on the server. Each SourceMember object has 4 fields:
 *    serverRevisionCounter: the current RevisionCounter on the server for this object
 *    lastRetrievedFromServer: the RevisionCounter last retrieved from the server for this object
 *    memberType: the metadata name of the SourceMember
 *    isNameObsolete: wether or not this object has been deleted.
 *
 *    ex.
 ```
 {
    serverMaxRevisionCounter: 3,
    sourceMembers: {
      ApexClass__MyClass: {
        serverRevisionCounter: 3,
        lastRetrievedFromServer: 2,
        memberType: ApexClass,
        isNameObsolete: false
      },
      CustomObject__Student__c: {
        serverRevisionCounter: 1,
        lastRetrievedFromServer: 1,
        memberType: CustomObject,
        isNameObsolete: false
      }
    }
  }
  ```
 * In this example, `ApexClass__MyClass` has been changed in the org because the `serverRevisionCounter` is different
 * from the `lastRetrievedFromServer`. When a pull is performed, all of the pulled members will have their counters set
 * to the corresponding `RevisionCounter` from the `SourceMember` of the org.
 */
export class MaxRevision extends ConfigFile<MaxRevision.Options> {
  logger!: Logger;
  private org: Org;
  private readonly FIRST_REVISION_COUNTER_API_VERSION: string = '47.0';
  private conn: Connection;
  private currentApiVersion: string;
  private static maxRevision: Dictionary<MaxRevision> = {};
  private isSourceTrackedOrg: boolean = true;

  /**
   * follows packageInfoCache's architecture, where getInstance is the entry method to the class
   * @param {MaxRevision.Options} options that contain the org's username
   * @returns {Promise<MaxRevision>} the maxRevision object for the given username
   */
  public static async getInstance(options: MaxRevision.Options): Promise<MaxRevision> {
    if (!this.maxRevision[options.username]) {
      this.maxRevision[options.username] = await MaxRevision.create(options);
    }
    return this.maxRevision[options.username];
  }

  public getFileName(): string {
    return 'maxRevision.json';
  }

  public async init() {
    this.options.filePath = pathJoin('.sfdx', 'orgs', this.options.username);
    this.options.filename = this.getFileName();
    this.org = await Org.create({ aliasOrUsername: this.options.username });
    this.logger = await Logger.child(this.constructor.name);
    this.conn = this.org.getConnection();
    this.currentApiVersion = this.conn.getApiVersion();

    try {
      await super.init();
    } catch (err) {
      if (err.name === 'JsonDataFormatError') {
        // this error is thrown when the old maxRevision.json is being read
        this.logger.debug('old maxRevision.json detected, converting to new schema');
        // transition from old maxRevision to new
        const filePath = path.join(process.cwd(), this.options.filePath, this.getFileName());
        // read the old maxRevision to get the 'serverMaxRevisionCounter'
        const oldMaxRevision: string = await fs.readFile(filePath, 'utf-8');
        // transform and overwrite the old file into the new schema
        await fs.writeFile(
          filePath,
          JSON.stringify({ serverMaxRevisionCounter: parseInt(oldMaxRevision), sourceMembers: {} }, null, 4)
        );
        await super.init();
      } else {
        throw SfdxError.wrap(err);
      }
    }

    const contents = this.getContents();
    if (!contents.serverMaxRevisionCounter && !contents.sourceMembers) {
      try {
        // Initialize if file didn't exist
        // to transition from RevisionNum to RevisionCounter correctly we need to get the max RevisionCounter
        // based on current SourceMembers that may be present in the org
        const result = await this.query(QUERY_MAX_REVISION_COUNTER);
        const maxRevisionCounter = getNumber(result, '[0].MaxRev', 0);

        this.logger.debug(`setting serverMaxRevisionCounter to ${maxRevisionCounter} on creation of the file`);

        contents.serverMaxRevisionCounter = maxRevisionCounter;
        contents.sourceMembers = {};
        // If there were already changes made in the org, update with those SourceMembers.
        if (maxRevisionCounter > 0) {
          const allSourceMembers = await this.queryAllSourceMembers();
          this.upsertSourceMembers(allSourceMembers);
        }
        await this.write();
      } catch (e) {
        // srcDevUtil.isSourceTrackedOrg() queries for Source Members on the org and if it errors it is determined to
        // be a non-source-tracked org. We're doing the same thing here and it saves us one extra query
        if (e.name === 'INVALID_TYPE' && e.message.includes("sObject type 'SourceMember' is not supported")) {
          // non-source-tracked org E.G. DevHub or trailhead playground
          this.isSourceTrackedOrg = false;
        }
      }
    }
  }

  /**
   * Returns the contents of maxRevision.json as `MaxJson`
   */
  public getContents(): MaxJson {
    // override getContents and cast here to avoid casting every getContents() call
    return this['contents'] as MaxJson;
  }

  /**
   * Returns whether maxRevision.json contains the specified key.
   *
   * @param key string of the form, <type>__<name> e.g.,`ApexClass__MyClass`
   */
  public hasSourceMember(key: string): boolean {
    return !!this.getContents().sourceMembers[key];
  }

  /**
   * Returns the `serverMaxRevisionCounter` property of maxRevision.json, which is the
   * last `RevisionCounter` retrieved from the org.
   */
  public getServerMaxRevision(): number {
    return this.getContents().serverMaxRevisionCounter;
  }

  /**
   * Returns all `SourceMembers` from maxRevision.json.
   */
  public getSourceMembers(): Dictionary<MemberRevision> {
    return this.getContents().sourceMembers;
  }

  /**
   * Returns the specified `SourceMember` from maxRevision.json or `undefined`.
   *
   * @param key string of the form, `<type>__<name>` e.g.,`ApexClass__MyClass`
   */
  public getSourceMember(key: string): Optional<MemberRevision> {
    return this.getSourceMembers()[key];
  }

  private setSourceMember(key: string, sourceMember: MemberRevision) {
    this.getContents().sourceMembers[key] = sourceMember;
  }

  // Inserts or updates the specified source member in maxRevision.json.
  private upsertToJson(change: SourceMember) {
    // try accessing the sourceMembers object at the index of the change's name
    // if it exists, we'll update the fields - if it doesn't, we'll create and insert it
    const key = MetadataRegistry.getMetadataKey(change.MemberType, change.MemberName);
    let sourceMember = this.getSourceMember(key);
    if (sourceMember) {
      // the sourceMember already existed so we'll be updating it
      this.logger.debug(`updating ${key} to RevisionCounter ${change.RevisionCounter}`);
      sourceMember.serverRevisionCounter = change.RevisionCounter;
      // set metadata type and isNameObsolete field
      sourceMember.memberType = change.MemberType;
      sourceMember.isNameObsolete = change.IsNameObsolete;
    } else if (!!change.MemberName) {
      // insert record
      this.logger.debug(`inserting ${key} with RevisionCounter: ${change.RevisionCounter}`);
      sourceMember = {
        serverRevisionCounter: change.RevisionCounter,
        lastRetrievedFromServer: null,
        memberType: change.MemberType,
        isNameObsolete: change.IsNameObsolete
      };
    }
    // set the contents of the config file to our new/updated sourcemember
    this.setSourceMember(key, sourceMember);
  }

  private upsertSourceMembers(sourceMembers: SourceMember[]) {
    sourceMembers.forEach(sourceMember => {
      this.upsertToJson(sourceMember);
    });
  }

  private async syncRevisionCounter(sourceMembers: SourceMember[]) {
    sourceMembers.forEach(member => {
      const key = MetadataRegistry.getMetadataKey(member.MemberType, member.MemberName);
      const sourceMember = this.getSourceMember(key);
      if (sourceMember) {
        sourceMember.lastRetrievedFromServer = sourceMember.serverRevisionCounter;
      }
    });
  }

  private convertRevisionToMember(memberKey: string, memberRevision: MemberRevision): SourceMember {
    return {
      MemberType: memberRevision.memberType,
      MemberName: memberKey.replace(`${memberRevision.memberType}__`, ''),
      RevisionCounter: memberRevision.serverRevisionCounter,
      IsNameObsolete: memberRevision.isNameObsolete
    };
  }

  /**
   * Returns the `SourceMembers` from maxRevision.json that have different `lastRetrievedFromServer`
   * and `serverRevisionCounter` numbers.
   */
  public async retrieveChangedElements(): Promise<SourceMember[]> {
    const returnElements: SourceMember[] = [];

    // Make sure there are no new SourceMembers on the server we don't know about.
    await this.retrieveAndWriteNewRevisions();

    const sourceMembers = this.getSourceMembers();
    Object.keys(sourceMembers).forEach(sourceMemberKey => {
      const sm = this.getSourceMember(sourceMemberKey);
      // if the numbers are different than there is a change
      if (sm.serverRevisionCounter !== sm.lastRetrievedFromServer) {
        // mimic the old results from the srcStatusApi.getRemoteChanges query
        returnElements.push(this.convertRevisionToMember(sourceMemberKey, sm));
      }
    });
    this.logger.debug(`Found ${returnElements.length} elements not synced down from server`);
    return returnElements;
  }

  /**
   * reads and writes maxJson and handles serverMaxRevisionCounter
   * @param sourceMembers
   */
  public async writeSourceMembers(sourceMembers: SourceMember[]) {
    if (sourceMembers.length > 0) {
      this.upsertSourceMembers(sourceMembers);
      await this.write();
    }
  }

  /**
   * Writes `SourceMembers` to maxRevision.json and sets the
   * `lastRetrievedFromServer` to the `serverRevisionCounter`.
   * This is called after a successful push or pull.
   */
  public async updateSourceTracking(sourceMembers?: SourceMember[]) {
    if (!sourceMembers) {
      sourceMembers = await this.retrieveAllSourceMembers();
    }
    if (sourceMembers.length > 0) {
      this.upsertSourceMembers(sourceMembers);
      await this.syncRevisionCounter(sourceMembers);
      await this.write();
    }
  }

  /**
   * Sets `serverMaxRevisionCounter` to the specific revision if greater than the current revision.
   *
   * @param rev new max revision number
   */
  public async setServerMaxRevision(rev: number) {
    if (this.getContents().serverMaxRevisionCounter < rev) {
      this.logger.debug(`new serverMaxRevisionCounter = ${rev}`);
      this.getContents().serverMaxRevisionCounter = rev;
      await this.write();
    }
  }

  public async setMaxRevisionCounterFromQuery() {
    const result = await this.query(QUERY_MAX_REVISION_COUNTER);
    const newMaxRev = result[0].MaxRev;

    return this.setServerMaxRevision(newMaxRev);
  }

  public async retrieveAndWriteNewRevisions(): Promise<void> {
    const newSourceMembers = await this.querySourceMembersFrom(this.getServerMaxRevision());
    this.upsertSourceMembers(newSourceMembers);
    this.write();
  }

  /**
   * Query all SourceMembers from the current serverMaxRevisionCounter and update the
   * maxRevision file with the query result, then return all SourceMembers from the file.
   */
  public async retrieveAllSourceMembers(): Promise<SourceMember[]> {
    await this.retrieveAndWriteNewRevisions();
    return Object.entries(this.getSourceMembers()).map(
      ([memberKey, memberRevision]): SourceMember => {
        return this.convertRevisionToMember(memberKey, memberRevision);
      }
    );
  }

  /**
   * Polls the org for SourceMember objects matching the provided metadata member names,
   * from the provided RevisionCounter number, waiting for the pollTimeLimit amount of seconds.
   * NOTE: This can be removed when the Team Dependency (TD-0085369) for W-7737094 is delivered.
   * @param memberNames Array of metadata names to poll for
   * @param pollTimeLimit the number of seconds to poll for SourceMembers before timing out
   * @param fromRevision the RevisionCounter number from which to poll for SourceMembers
   */
  public async pollForSourceMembers(memberNames: string[], pollTimeLimit = 120): Promise<SourceMember[]> {
    const fromRevision = this.getServerMaxRevision();
    if (memberNames.length === 0) {
      // Don't bother polling if we're not matching SourceMembers
      pollTimeLimit = 0;
    }
    this.logger.debug(`Polling for ${memberNames.length} SourceMembers 
      from revision ${fromRevision} with time limit of ${pollTimeLimit}s`);

    let pollTime = 0;
    let found = false;
    const membersToMatch = memberNames.reduce((map, memberName) => {
      map[memberName] = memberName;
      return map;
    }, {});

    const poll = async (): Promise<SourceMember[]> => {
      const allMembers = await this.querySourceMembersFrom(fromRevision);

      for (const member of allMembers) {
        delete membersToMatch[member.MemberName];
      }

      found = Object.entries(membersToMatch).length === 0;

      if (found || pollTime >= pollTimeLimit) return allMembers;

      this.logger.debug('Polling every 1s for SourceMembers...');
      await sleep(Duration.seconds(1));
      pollTime += 1;
      return poll();
    };
    const sourceMembers = await poll();

    if (found) {
      this.logger.debug(`Retrieved all SourceMember data after ${pollTime}s`);
    } else {
      this.logger.warn(`Polling for SourceMembers timed out after ${pollTime}s`);
    }

    return sourceMembers;
  }

  public async querySourceMembersFrom(fromRevision: number): Promise<SourceMember[]> {
    // because `serverMaxRevisionCounter` is always updated, we need to select > to catch the most recent change
    const query = `SELECT MemberType, MemberName, IsNameObsolete, RevisionCounter FROM SourceMember WHERE RevisionCounter > ${fromRevision}`;
    return this.query(query);
  }

  public async queryAllSourceMembers(): Promise<SourceMember[]> {
    return this.query('SELECT MemberName, MemberType, RevisionCounter from SourceMember');
  }

  // now that this is private, test stubs will have @ts-ignore
  private async query<T>(query: string) {
    // to switch to using RevisionCounter - apiVersion > 46.0
    // set the api version of the connection to 47.0, query, revert api version
    if (!this.isSourceTrackedOrg) {
      throw SfdxError.create('salesforce-alm', 'source', 'NonSourceTrackedOrgError');
    }
    this.logger.debug(query);

    let results;
    if (parseFloat(this.currentApiVersion) < parseFloat(this.FIRST_REVISION_COUNTER_API_VERSION)) {
      this.conn.setApiVersion(this.FIRST_REVISION_COUNTER_API_VERSION);
      results = await this.conn.tooling.autoFetchQuery<T>(query);
      this.conn.setApiVersion(this.currentApiVersion);
    } else {
      results = await this.conn.tooling.autoFetchQuery<T>(query);
    }
    return results.records;
  }
}

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthInfo, Connection, Logger } from '@salesforce/core';
import { OutputFlags } from '@oclif/parser';
import * as ConfigApi from '../../../../lib/core/configApi';
import consts = require('../../../../lib/core/constants');
import pkgUtils = require('../../../../lib/package/packageUtils');

// Import i18n messages
import Messages = require('../../../../lib/messages');
const messages = Messages();

export class PackageVersionDisplayAncestryCommand extends SfdxCommand {
  public static readonly description = messages.getMessage('cliDescription', [], 'package_displayancestry');
  public static readonly longDescription = messages.getMessage('cliDescriptionLong', [], 'package_displayancestry');
  public static readonly help = messages.getMessage('help', [], 'package_displayancestry');

  public static readonly showProgress = false;
  public static readonly varargs = false;
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresDevhubUsername = true;

  // The first chunk of the query is what makes them unique, and the unit tests rely on these, so making them const
  // and public will allow for normalization
  public static readonly SELECT_ALL_ROOTS = 'SELECT SubscriberPackageVersionId FROM Package2Version';
  public static readonly SELECT_ROOT_INFO =
    'SELECT MajorVersion, MinorVersion, PatchVersion, BuildNumber FROM Package2Version';
  public static readonly SELECT_CHILD_INFO =
    'SELECT SubscriberPackageVersionId, MajorVersion, MinorVersion, PatchVersion, BuildNumber FROM Package2Version';
  public static readonly SELECT_PARENT_INFO =
    'SELECT AncestorId, MajorVersion, MinorVersion, PatchVersion, BuildNumber FROM Package2Version';

  public static readonly SELECT_PACKAGE_CONTAINER_OPTIONS = 'SELECT ContainerOptions FROM Package2';

  public static readonly SELECT_PACKAGE_VERSION_CONTAINER_OPTIONS =
    'SELECT Package2ContainerOptions FROM SubscriberPackageVersion';

  // Add this to query calls to only show released package versions in the output
  public releasedOnlyFilter = ' AND IsReleased = true';

  // Parse flags
  public static readonly flagsConfig: FlagsConfig = {
    // --json is configured automatically
    package: flags.string({
      char: 'p',
      description: messages.getMessage('package', [], 'package_displayancestry'),
      longDescription: messages.getMessage('packageLong', [], 'package_displayancestry'),
      required: true,
    }),
    dotcode: flags.boolean({
      description: messages.getMessage('dotcode', [], 'package_displayancestry'),
      longDescription: messages.getMessage('dotcodeLong', [], 'package_displayancestry'),
    }),
    verbose: flags.builtin({
      description: messages.getMessage('verbose', [], 'package_displayancestry'),
      longDescription: messages.getMessage('verboseLong', [], 'package_displayancestry'),
    }),
  };

  public async run(): Promise<unknown> {
    const org = this.org || this.hubOrg;
    const username: string = org.getUsername();

    return await this._findAncestry(username, this.flags);
  }

  /**
   * Finds the ancestry of the given package.
   *  <p>This was separated out from the run() method so that unit testing could actually be done. This is admittedly a bit of a hack, but I think every other command does it too?
   *  // TODO: Maybe some CLI whiz could make this not be needed
   *  </p>
   *
   * @param username - username of the org
   * @param flags - the flags passed in
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/no-shadow
  protected async _findAncestry(username: string, flags: OutputFlags<any>) {
    this.logger = await Logger.child(this.constructor.name);
    this.logger.debug('Ancestry started with args %s', flags);
    this.flags = flags; // Needed incase we're running from a unit test.

    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username }),
    });

    // Connection.create() defaults to the latest API version, but the user can override it with this flag.
    if (flags.apiversion != undefined) {
      connection.setApiVersion(flags.apiversion);
    }

    let dotcodeOutput = 'strict graph G {\n';
    let unicodeOutput = '';
    const forest: TreeNode[] = [];
    const packageId: string = flags.package;
    const roots: string[] = [];

    // Get the roots based on what packageId is.
    switch (packageId.substr(0, 3)) {
      // If this an 0Ho, we need to get all the roots of this package
      case '0Ho':
        // Validate, and then fetch
        try {
          pkgUtils.validateId(pkgUtils.BY_LABEL.PACKAGE_ID, packageId);
        } catch (err) {
          throw new Error(messages.getMessage('invalidId', packageId, 'package_displayancestry'));
        }

        // Check to see if the package is an unlocked package
        // if so, throw and error since ancestry only applies to managed packages
        const query =
          PackageVersionDisplayAncestryCommand.SELECT_PACKAGE_CONTAINER_OPTIONS + ` WHERE Id = '${packageId}'`;
        const packageTypeResults: Array<{
          ContainerOptions?: string;
        }> = await this.executeQuery(connection, query);

        if (packageTypeResults && packageTypeResults.length === 0) {
          throw new Error(messages.getMessage('invalidId', packageId, 'package_displayancestry'));
        } else if (
          packageTypeResults &&
          packageTypeResults.length === 1 &&
          packageTypeResults[0]['ContainerOptions'] !== 'Managed'
        ) {
          throw new Error(messages.getMessage('unlockedPackageError', [], 'package_displayancestry'));
        }

        const normalQuery =
          PackageVersionDisplayAncestryCommand.SELECT_ALL_ROOTS +
          ` WHERE AncestorId = NULL AND Package2Id = '${packageId}' ${this.releasedOnlyFilter}`;
        const results: Array<{
          SubscriberPackageVersionId?: string;
        }> = await this.executeQuery(connection, normalQuery);

        // The package exists, but there are no versions for the provided package
        if (results.length == 0) {
          throw new Error(messages.getMessage('noVersionsError', [], 'package_displayancestry'));
        }

        results.forEach((row) => roots.push(row.SubscriberPackageVersionId));
        break;

      // If this is an 04t, we were already given our root id, and we also want to go up
      case '04t':
        // Validate id
        try {
          pkgUtils.validateId(pkgUtils.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, packageId);
        } catch (err) {
          throw new Error(messages.getMessage('invalidId', packageId, 'package_displayancestry'));
        }

        // Check to see if the package version is part of an unlocked package
        // if so, throw and error since ancestry only applies to managed packages
        const versionQuery =
          PackageVersionDisplayAncestryCommand.SELECT_PACKAGE_VERSION_CONTAINER_OPTIONS + ` WHERE Id = '${packageId}'`;
        const packageVersionTypeResults: Array<{
          ContainerOptions?: string;
        }> = await this.executeQuery(connection, versionQuery);

        if (
          packageVersionTypeResults &&
          packageVersionTypeResults.length === 1 &&
          packageVersionTypeResults[0]['Package2ContainerOptions'] !== 'Managed'
        ) {
          throw new Error(messages.getMessage('unlockedPackageError', [], 'package_displayancestry'));
        }

        // since this is a package version, we don't want to filter on only released package versions
        this.releasedOnlyFilter = '';

        roots.push(packageId);
        unicodeOutput += (await this.ancestorsFromLeaf(flags.package, connection)) + '\n\n';
        break;

      // Else, this is likely an alias. So attempt to find the package information from the alias.
      default:
        let id;
        const workspaceConfigFilename = new ConfigApi.Config().getWorkspaceConfigFilename();
        try {
          const parseConfigFile = JSON.parse(fs.readFileSync(workspaceConfigFilename, 'utf8'));
          id = parseConfigFile.packageAliases[packageId];
        } catch (err) {
          throw new Error(messages.getMessage('parseError', [], 'package_displayancestry'));
        }

        if (id === undefined) {
          throw new Error(messages.getMessage('invalidAlias', packageId, 'package_displayancestry'));
        }

        this.debug(`Matched ${packageId} to ${id}`);

        // If we have the alias, re-run this function with the new ID, so that it can hit the two cases above
        flags.package = id;
        return this._findAncestry(username, flags);
    }

    // For every root node, build the tree below it.
    for (const rootId of roots) {
      const { root, dotOutput } = await this.exploreTreeFromRoot(connection, rootId);
      forest.push(root);
      dotcodeOutput += dotOutput;
    }

    dotcodeOutput += '}\n';

    // Determine proper output based on flags
    if (!flags.json) {
      if (flags.dotcode) {
        this.ux.log(dotcodeOutput);
        return dotcodeOutput;
      } else {
        unicodeOutput += this.createUnicodeTreeOutput(forest);
        this.ux.log(unicodeOutput);
        return unicodeOutput;
      }
    } else {
      if (flags.dotcode) {
        // if they ask for *both* dotcode *and* json, give them the compiled string.
        return dotcodeOutput;
      } else {
        return forest;
      }
    }
  }

  /**
   * Builds the bottom-up view from a leaf.
   *
   * @param nodeId - the 04t of this node
   * @param connection - the connection object
   */
  private async ancestorsFromLeaf(nodeId: string, connection: Connection): Promise<string> {
    let output = '';

    // Start with the node, and shoot up
    while (nodeId != null) {
      const query = `${PackageVersionDisplayAncestryCommand.SELECT_PARENT_INFO} WHERE SubscriberPackageVersionId = '${nodeId}' ${this.releasedOnlyFilter}`;

      const results: Array<{
        MajorVersion?: string;
        MinorVersion?: string;
        PatchVersion?: string;
        AncestorId?: string;
        BuildNumber?: string;
      }> = await this.executeQuery(connection, query);

      if (results.length == 0) {
        throw new Error(messages.getMessage('versionNotFound', nodeId, 'package_displayancestry'));
      }

      // @ts-ignore - ignoring this error, since results is guaranteed at runtime to have Major/Minor/etc, but TS doesn't know this at compile time.
      const node = new TreeNode({ ...results[0], depthCounter: 0, SubscriberPackageVersionId: nodeId });
      output += `${PackageVersionDisplayAncestryCommand.buildVersionOutput(node)} -> `;
      nodeId = results[0].AncestorId;
    }

    // remove the last " -> " from the output string
    output = output.substr(0, output.length - 4);
    output += ' (root)';
    return output;
  }

  /**
   * Makes this tree from starting root this is so that we can be given a package Id and then create the forest of versions
   *
   * @param connection
   * @param rootId the subscriber package version id for this root version.
   */
  private async exploreTreeFromRoot(connection, rootId: string): Promise<{ root: TreeNode; dotOutput: string }> {
    // Before we do anything, we need *all* the package information for this node, and they just gave us the ID
    const query =
      PackageVersionDisplayAncestryCommand.SELECT_ROOT_INFO +
      ` WHERE SubscriberPackageVersionId = '${rootId}' ${this.releasedOnlyFilter}`;

    const results: Array<{
      MajorVersion?: string;
      MinorVersion?: string;
      PatchVersion?: string;
      BuildNumber?: string;
    }> = await this.executeQuery(connection, query);
    const rootInfo = new PackageInformation(
      rootId,
      results[0].MajorVersion,
      results[0].MinorVersion,
      results[0].PatchVersion,
      results[0].BuildNumber
    );

    // Setup our BFS
    const visitedSet = new Set<string>(); // If this is *always* a tree, not needed. But if there's somehow a cycle (a dev screwed something up, maybe?), this will prevent an infinite loop.
    // eslint-disable-next-line no-array-constructor
    const dfsStack = new Array<TreeNode>();
    const root = new TreeNode(rootInfo);
    dfsStack.push(root);

    // Traverse!
    let dotOutput = PackageVersionDisplayAncestryCommand.buildDotNode(root);

    while (dfsStack.length > 0) {
      const currentNode = dfsStack.pop(); // DFS

      // Skip already visited elements
      if (visitedSet.has(currentNode.data.SubscriberPackageVersionId)) {
        continue;
      }

      visitedSet.add(currentNode.data.SubscriberPackageVersionId);

      // Find all children, ordered from smallest -> largest
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const query =
        PackageVersionDisplayAncestryCommand.SELECT_CHILD_INFO +
        ` WHERE AncestorId = '${currentNode.data.SubscriberPackageVersionId}' ${this.releasedOnlyFilter}
        ORDER BY MajorVersion ASC, MinorVersion ASC, PatchVersion ASC`;

      // eslint-disable-next-line @typescript-eslint/no-shadow
      const results: Array<{
        SubscriberPackageVersionId?: string;
        MajorVersion?: string;
        MinorVersion?: string;
        PatchVersion?: string;
        BuildNumber?: string;
      }> = await this.executeQuery(connection, query);

      // We want to print in-order, but add to our stack in reverse-order so that we both print *and* visit nodes
      // left -> right, as the dfaStack will visit right -> left if we don't do this.
      const reversalStack: TreeNode[] = [];
      // eslint-disable-next-line no-loop-func
      results.forEach((row) => {
        const childPackageInfo = new PackageInformation(
          row.SubscriberPackageVersionId,
          row.MajorVersion,
          row.MinorVersion,
          row.PatchVersion,
          row.BuildNumber,
          currentNode.data.depthCounter + 1
        );
        const childNode = new TreeNode(childPackageInfo);

        currentNode.addChild(childNode);
        reversalStack.push(childNode);

        dotOutput += PackageVersionDisplayAncestryCommand.buildDotNode(childNode);
        dotOutput += PackageVersionDisplayAncestryCommand.buildDotEdge(currentNode, childNode);
      });

      // Important to reverse, so that we visit the children left -> right, not right -> left.
      reversalStack.reverse().forEach((child) => dfsStack.push(child));
    }

    return { root, dotOutput };
  }

  /**
   * Creates the fancy NPM-LS unicode tree output
   * Idea from: https://github.com/substack/node-archy
   *
   * @param forest
   */
  private createUnicodeTreeOutput(forest: TreeNode[]): string {
    let result = '';

    // DFS from each root
    for (const root of forest) {
      result += this.unicodeOutputTraversal(root, null, '');
    }

    return result;
  }

  /**
   * Builds the unicode output of this tree.
   *  <p>
   *      Root is handled differently, to make it look better / stand out as the root.
   *      This complicates the code flow somewhat.
   *  </p>
   *
   * @param node - current node
   * @param parent - the parent of the current node
   * @param prefix - the current prefix, so that we 'indent' far enough
   */
  private unicodeOutputTraversal(node: TreeNode, parent: TreeNode, prefix: string): string {
    let newPrefix = prefix;
    let result = '';

    // Root is special, just a line with no up-arrow part.
    if (parent === null) {
      newPrefix = '─';
    } else {
      // If we're the last child, use └ instead of ├
      if (parent.children.indexOf(node) == parent.children.length - 1) {
        newPrefix += '└─';
      } else {
        newPrefix += '├─';
      }
    }

    // If we have children, add a ┬, else it's just a ─
    if (node.children.length > 0) {
      newPrefix += '┬ ';
    } else {
      newPrefix += '─ ';
    }

    // This line is whatever the prefix is, followed by the number
    result += newPrefix + `${PackageVersionDisplayAncestryCommand.buildVersionOutput(node)}`;

    // Add 04t to output if verbose mode
    if (this.flags.verbose) {
      result += ` (${node.data.SubscriberPackageVersionId})`;
    }

    result += '\n';

    // If we have children, indent a level and go in
    if (node.children.length != 0) {
      // Root is special (a single space)
      if (parent === null) {
        prefix += ' ';
      }
      // if we're the last child, no vertical lines, just spaces
      else if (parent.children[parent.children.length - 1] === node) {
        prefix += '  ';
      }
      // lastly is everyone else (the majority of the cases).
      else {
        prefix += '│ ';
      }

      for (const child of node.children) {
        result += this.unicodeOutputTraversal(child, node, prefix);
      }
    }

    return result;
  }

  /**
   * Builds a node line in DOT, of the form nodeID [label="MAJOR.MINOR.PATCH"]
   *
   * @param currentNode
   */
  private static buildDotNode(currentNode: TreeNode): string {
    return `\t node${
      currentNode.data.SubscriberPackageVersionId
    } [label="${PackageVersionDisplayAncestryCommand.buildVersionOutput(currentNode)}"]\n`;
  }

  /**
   * Builds an edge line in DOT, of the form fromNode -- toNode
   *
   * @param fromNode
   * @param toNode
   */
  private static buildDotEdge(fromNode: TreeNode, toNode: TreeNode): string {
    return `\t node${fromNode.data.SubscriberPackageVersionId} -- node${toNode.data.SubscriberPackageVersionId}\n`;
  }

  /**
   * Runs a single query, and returns a promise with the results
   *
   * @param connection
   * @param query
   */
  private executeQuery(connection: Connection, query: string): Promise<Array<{}>> {
    return connection.tooling
      .autoFetchQuery(query)
      .then((queryResult) => {
        const records: Array<{ attributes?: {} }> = queryResult.records;
        const results: Array<{}> = []; // Array of objects.

        this.logger.debug('Query results: ');
        this.logger.debug(records);

        // Halt here if we have nothing to return
        if (!records || records.length <= 0) {
          return results;
        }

        records.forEach((record) => {
          // This seems like a hack, but TypeScript is cool so we use it. Since we (usually) want
          // almost *everything* from this record, rather than specifying everything we *do* want,
          // instead specify only the things we do *NOT* want, and use `propertiesWeWant`
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { attributes, ...propertiesWeWant } = record;
          results.push(propertiesWeWant);
        });

        this.logger.debug('Parsed results: ');
        this.logger.debug(results);

        return results;
      })
      .catch(() => {
        throw new Error(messages.getMessage('invalidId', '', 'package_displayancestry'));
      });
  }

  /**
   * Building {Major}.{Minor}.{Patch}.{BuildNumber} is done in many places, so centralize.
   *
   * @param node
   */
  private static buildVersionOutput(node: TreeNode): string {
    return `${node.data.MajorVersion}.${node.data.MinorVersion}.${node.data.PatchVersion}.${node.data.BuildNumber}`;
  }
}

/**
 * A treenode used to create the package version history for the JSON output.
 */
export class TreeNode {
  data: PackageInformation;
  children: TreeNode[];

  constructor(data: PackageInformation) {
    this.data = data;
    this.children = [];
  }

  /**
   * Adds a child to this node
   *
   * @param child
   */
  addChild(child: TreeNode): void {
    this.children.push(child);
  }
}

/**
 * This is the 'data' part of TreeNode, a collection of useful version information.
 */
class PackageInformation {
  SubscriberPackageVersionId: string;
  MajorVersion: string;
  MinorVersion: string;
  PatchVersion: string;
  BuildNumber: string;
  depthCounter: number;

  constructor(
    SubscriberPackageVersionId: string,
    MajorVersion: string,
    MinorVersion: string,
    PatchVersion: string,
    BuildNumber: string,
    depthCounter = 0
  ) {
    this.SubscriberPackageVersionId = SubscriberPackageVersionId;
    this.MajorVersion = MajorVersion;
    this.MinorVersion = MinorVersion;
    this.PatchVersion = PatchVersion;
    this.BuildNumber = BuildNumber;
    this.depthCounter = depthCounter;
  }
}

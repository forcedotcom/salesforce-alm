/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as util from 'util';
import { isArray } from '@salesforce/ts-types';

const TARGET_USERNAME_PARAM = 'targetusername';
const PERF_LOG_LEVEL_PARAM = 'perflog';

const messages = {
  default: {
    en_US: {
      // common
      actionRequiredHeader: 'Action Required!',
      // errors
      WildCardError:
        "ERROR: This command doesn't support wildcards. Remove the wildcard, and run the command again.\nSee --help for examples.",
      GeneralCommandFailure: 'This command failed.',
      InvalidProjectWorkspace: 'This directory does not contain a valid Salesforce DX project.',
      MissingClientConfig: 'Missing a client configuration. Please run the config command.',
      TestMessage: 'This is a test message do not change.',
      MissingAppConfig: 'The current project is invalid. sfdx-project.json is missing.',
      OldSfdxWorkspaceJsonPresent: 'Project file %s/sfdx-workspace.json needs to be renamed to sfdx-project.json',
      UndefinedLocalizationLabel: 'Missing label %s:%s for locale %s.',
      LoginServerNotFound: 'The hostname for the login server is not found: %s:%s',
      InvalidProjectDescriptor: 'This project descriptor is in invalid. The attribute [%s] is not found.',
      MissingRequiredParameter: 'A required parameter [%s] is missing.',
      InvalidParameter: 'Invalid [%s] parameter: %s',
      MissingScratchOrgNamespace: 'The [NamespacePrefix] is missing from the ScratchOrgInfo.',
      MaxOrgIds: 'The maximum number of local orgs (%s) has been reached',
      MaxOrgIdsAction: 'Use "sfdx force:org:list --clean" to remove outdated org configurations.',
      UserSessionIsInvalid: '%s: The user session for this org is expired or invalid. Please run config.',
      MissingScratchOrgDef: 'A scratch org definition file not found at %s. Please create it.',
      NonScratchOrgPush:
        'You can push source only to scratch orgs using this command. ' +
        'Use "sfdx force:source:deploy" or "sfdx force:mdapi:deploy" to deploy changes to orgs that don’t have change tracking.',
      ProblemQueryingOrganizationSettingsDetail: 'No organization settings found',
      ProblemSettingOrgPrefs: 'Cannot set org preferences. %s',
      ProblemDeployingSettings: 'Failed to deploy settings to scratch org.',
      PathDoesNotExist: 'The specified path [%s] does not exist',
      InvalidArgumentFilePath: 'Invalid argument to --%s. You specified a directory path [%s], but a file is required.',
      InvalidArgumentDirectoryPath:
        'Invalid argument to --%s. You specified a file path [%s], but a directory is required.',
      InvalidValueForDefaultPath:
        'In sfdx-project.json, set the default to true or false. Example: [{ "path": "packageDirectory1", "default": true }, { "path": "packageDirectory2", "default": false }]',
      MultipleDefaultPaths: 'In sfdx-project.json, indicate only one package directory (path) as the default.',
      MissingDefaultPath:
        'In sfdx-project.json, be sure to specify which package directory (path) is the default. Example: [{ "path": "packageDirectory1", "default": true }, { "path": "packageDirectory2" }]',
      InvalidPackageDirectory:
        'The path %s, specified in sfdx-project.json, does not exist. Be sure this directory is included in your project root.',
      InvalidAbsolutePath:
        'The path %s, specified in sfdx-project.json, must be indicated as a relative path to the project root.',
      IncorrectLogLevel: 'valid values are {%s}',
      LoggerNameRequired: 'A logger name is required',
      InvalidVariableReference: 'Invalid variable reference: variable "%s" not found or unset.',
      ValidationSchemaFieldErrors: 'Schema validation failed with following errors:\n%s',
      ValidationSchemaUnknown: 'Schema validation failed with unknown error',
      InvalidJson: 'An error occurred parsing "%s"',
      JsonParseError: 'Parse error in file %s on line %s\n%s\n',
      InvalidJsonCasing:
        'All JSON input must have heads down camelcase keys.  E.g., { sfdcLoginUrl: "https://login.salesforce.com" }\nFound "%s" in\n%s',
      NoWorkspaceOrUser: `Command must be executed in a project directory or with the --${TARGET_USERNAME_PARAM} flag.`,
      OrgDataNotAvailableError:
        'An attempt to refresh the authentication token failed with a "Data Not Found Error". The org identified by username %s doesn\'t appear to exist. Likely cause is that the org was deleted by another user or has expired.',
      OrgDataNotAvailableErrorAction:
        'Run "sfdx force:org:list --clean" to remove stale org authentications.\nUse "sfdx force:config" to update the defaultusername.\nUse "sfdx force:org:create" to create a new org.\nUse "sfdx force:auth" to authenticate an existing org.',
      InvalidCommandGroup:
        'You have specified an invalid command group in which to stash your values. Please verify that you are specifying a valid command or register your command in stash.js under Stash#Commands.',
      // help
      schemaInfoOption:
        'display schema information for the --%s configuration file to stdout; if you use this option, all other options except --json are ignored',
      schemaInfoOptionLong:
        'Displays the schema information for the configuration file. If you use this option, all other options, except --json, are ignored.',
      invalidInstanceUrlForAccessTokenAction:
        'Verify that the instanceUrl config setting is set to the instance that the access token belongs to.' +
        '\nUse "sfdx force:config:list" to view your current setting.' +
        '\nUse "sfdx force:config:set instanceUrl=<instance URL> --global" to set your instanceUrl to the correct instance.',
      invalidBooleanConfigValue: 'The config value can only be set to true or false.',

      cliForceConfigHelp: 'configures this project with a scratch org',
      cliForceConfigHelpClientId: 'specify the connected app client ID for the master org',
      cliForceConfigHelpClientSecret: 'specify the connected app client secret for the master org',
      cliForceConfigHelpClientRedirectUri: 'specify the connected app redirect uri for the master org',
      cliForceConfigHelpUsername: 'the master org username',
      cliForceConfigHelpPassword: 'the master org password',
      cliForceConfigHelpSuccess: 'successfully updated the SFDC accessToken',
      cliForceSyncHelp: 'synchronize Salesforce source between the scratch org and the project',
      cliForceSyncUpHelp: 'synchronize project source to the scratch org',
      cliForceSyncDownHelp: 'synchronize scratch org source to the project',
      cliForceHelp: 'tools for the Salesforce developer',
      cliForceSyncTypeHelp: '[All | Changed] Sync all or only the changed source. All is default.',
      cliForceRefreshHelp: 'Refreshes the auth token for the scratch org.',
      cliForceRefreshSuccess: 'Successfully reset the org auth token. Chive on!',
      cliForceCreateHelpType: 'The type of source to create. Values: [ScratchOrg]]',
      cliForceCreateHelpFile: 'Path to a file containing org signup parameters, in JSON format.',
      cliForceCreateHelpJson: 'The org signup parameters in JSON format.',
      cliForceCreateHelpPassword: 'Password for the admin user.',
      cliForceCreateMessageWrongType: 'Unsupported type. Valid types are [%s].',
      cliForceCreateMessageSuccess: 'Scratch org successfully created with id: %s',
      cliForceCreateMessagePassword: 'Setting org password...',
      cliForceCreateMessagePasswordOk: 'Ok',
      cliForceCreateNoConfig: 'Please specify an org configuration via file and/or key=value pairs',
      cliForceTestRunHelp: 'Invoke Apex tests in a given org.',
      cliForceTestRunHelp_results:
        'Wait for results. Display results when tests are complete. If false, use "getTestResults -i [runTestId]" command to get results.',
      cliForceTestRunHelp_classIds: 'Apex Class Ids to test.',
      cliForceTestRunHelp_suiteIds: 'Test Suite Ids to test (WIP).',
      cliForceTestGetResultsHelp: 'Retrieve test results for given runTestId in a given org.',
      cliForceTestGetResultsHelp_id: 'Id of test run.',
      oauthBrowserSuccess: 'Successfully updated the auth configuration for the org.',
      closeTheBrowser: 'You may now close the browser.',
      urlStateMismatch: 'The Oauth redirect listener encountered an http request that is not trusted. Ignoring.',
      keyChainItemCreateFailed: 'Attempting to create an encryption key failed. %s',
      UnsupportedOperatingSystem: 'Unsupported Operating System: %s',
      invalidEncryptedFormat: 'The encrypted data is not properly formatted.',
      invalidEncryptedFormatAction:
        'If attempting to create a scratch org then re-authorize. Otherwise create a new scratch org.',
      authDecryptFailed: 'Failed to decipher auth data. reason: %s.',
      genericTimeoutMessage: 'Socket timeout occurred while listening for results.',
      genericTimeoutCommandWaitMessageAction:
        'Use command "%s" to retry. You may consider increasing --wait parameter value to increase timeout.',
      genericTimeoutWaitMessageAction: 'You may consider increasing the --wait parameter value to increase timeout.',
      subscriberHandshakeTimeout: 'Subscriber handshake failed due to a socket timeout.',
      subscriberHandshakeTimeoutAction: 'Check your connection to force.com and try again',
      herokuTopicDescription: 'tools for the Salesforce developer',
      invalidApiVersion: 'An invalid api version is being reported by config. (apiVersion=%s)',
      streamingWait: 'the streaming client socket timeout (in minutes)',
      streamingWaitLong:
        'Sets the streaming client socket timeout, in minutes. ' +
        'If the streaming client socket has no contact from the server for a number of minutes, the client exits. ' +
        'Specify a longer wait time if timeouts occur frequently.',
      createOrgCommandDuration: 'duration of the scratch org (in days) (default:7, min:1, max:30)',
      createOrgCommandDurationLong:
        'Sets the duration of the scratch org, in days. ' + 'Valid values are from 1-30. The default is 7 days.',
      unrecognizedScratchOrgOption: '%s is not a supported option for scratch org configuration.',

      herokuNamespaceDescription: 'tools for the Salesforce developer',

      communityTopicDescription: 'create and publish a community',
      communityTopicLongDescription:
        'Use the community commands to create and publish a community, and view a list of available templates in you org.',

      jsonOutputOption: 'format output as json',
      jsonOutputOptionLong: 'Format output as JSON.',
      loglevelOption: 'logging level for this command invocation',
      loglevelOptionLong: 'The logging level for this command invocation. Logs are stored in $HOME/.sfdx/sfdx.log.',
      usernameOption: 'username or alias for the target org',
      usernameOptionLong: 'A username or alias for the target org.',
      targetUsernameOption: 'username or alias for the target org; overrides default target org',
      targetUsernameOptionLong: 'A username or alias for the target org. Overrides the default target org.',
      perfLogLevelOption: 'get API performance data',
      perfLogLevelOptionLong:
        'Gets data on API performance metrics from the server. The data is stored in $HOME/.sfdx/apiPerformanceLog.json',
      invalidPortNumber: 'Invalid OAuth redirect port number defined: %s',

      ClientSecretRequired: 'The client secret is required.',
      authorizeCommandMissingJwtOption: 'Both username and file must be provided.',
      authorizeCommandMissingClientId: 'The client ID is required for the JWT-based authentication process',
      authorizeCommandSuccess: 'Successfully authorized %s with org ID %s',
      authorizeCommandCloseBrowser: 'You may now close the browser',
      createOrgCommandSuccess: 'Successfully created scratch org: %s, username: %s',
      createOrgCommandDescription: 'create a scratch org',
      createOrgCommandDescriptionLong:
        'Creates a scratch org using values specified in a configuration file or ' +
        'key=value pairs that you specify on the command line. Values specified on the command line override values in the configuration file.',
      createOrgCommandHelp:
        'To set up a connected app for your new scratch org, specify the value that was ' +
        'returned when you created a connected app in your Dev Hub org as --clientid.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:org:create -f config/enterprise-scratch-def.json -a TestOrg1' +
        '\n   $ sfdx force:org:create -a MyDevOrg -s -v me@myhub.org edition=Developer' +
        '\n   $ sfdx force:org:create -f config/enterprise-scratch-def.json -a OrgWithOverrides username=testuser1@mycompany.org',
      createOrgCommandClientId: 'connected app consumer key',
      createOrgCommandClientIdLong: 'Connected app consumer key, as configured in your Dev Hub.',
      createOrgCommandSet: 'set the created org as the default username',
      createOrgCommandSetLong: 'Sets the created org as the default username.',
      createOrgCommandAlias: 'set an alias for the created scratch org',
      createOrgCommandAliasLong: 'Sets an alias for the created scratch org.',
      createOrgTargetDevhubUsername: 'username or alias for the dev hub org; overrides default dev hub org',
      createOrgTargetDevhubUsernameLong:
        'A username or alias for the target Dev Hub org. Overrides the default Dev Hub org.',
      createOrgCommandFile: 'path to a scratch org definition file',
      createOrgCommandFileLong:
        'Path to a scratch org definition file. Either --definitionfile or ' +
        'a vararg value for edition (for example, edition=Developer) is required. ' +
        'Varargs override the values in the scratch org definition file.',
      createOrgCommandObject: 'scratch org definition in json format ',
      createOrgCommandObjectLong:
        'Scratch org definition in JSON format. Either --definitionfile or ' + '--definitionjson is required.',
      createOrgCommandNoNamespace: 'creates the scratch org with no namespace',
      createOrgCommandNoNamespaceLong:
        'Creates the scratch org with no namespace. Useful when using a scratch ' +
        'org to test installations of packages with namespaces.',
      createOrgCommandNoAncestors: 'do not include second-generation package ancestors in the scratch org',
      createOrgCommandNoAncestorsLong: 'Do not include second-generation package ancestors in the scratch org.',
      createOrgCommandEnv: 'environment where the scratch org is created: [%s]',
      createOrgCommandEnvLong: 'Environment where the scratch org is created: [%s].',
      createOrgCommandUnauthorized: 'You do not have access to the [%s] object',
      createOrgTimeoutHintNoIdAction: 'Retry creating the org but increase the wait timeout.',
      apexReportCommandNoTestFound: 'No test found with the given names [%s]',
      apexReportCommandNoJobId: 'No test run job ID found.',
      apexReportCommandInvalidJobId: 'Invalid test run job ID: ',
      apexReportCommandInvalidResponse: 'Invalid API response: %s',
      apexReportCommandTestResultRetrievalFailed: 'Unable to get test results for job [%s]: [%s]',
      apexReportCommandCodeCoverageRetrievalFailed: 'Unable to get code coverage for job [%s]: [%s]',
      CoverageWithoutReporter: 'A result format is required when specifying codecoverage',
      apexTestApiInvalidReporter: 'Unknown result format type. Must be one of the following values: %s',
      apexTestApiInvalidTestRunId: 'Test run job ID not found: %s',
      apexTestApiInvalidTestLevel: 'Unknown testlevel `%s`. Must be one of the following values: [%s]',
      apexTestApiIncorrectTestLevel:
        'When specifying classnames, suitenames, or tests, the provided testlevel must be RunSpecifiedTests',
      apexTestApiInvalidParams: 'Specify either classnames, suitenames, or tests',
      InvalidAsyncTestJob: 'Unable to invoke async test job: %s',
      InvalidAsyncTestJobUnknownAction:
        'Try running the tests in the Developer Console by using force:org:open, or create a new scratch org and try again.',
      InvalidAsyncTestJobNoneFound:
        'Unable to invoke any tests. Ensure the tests are loaded into the org or valid inputs are supplied.',

      unsupportedValueForEnv: 'Unsupported value for env: [%s]',
      unsupportedValueForDuration: 'Unsupported value for durationdays (must be 1-30): [%s]',

      invalid_client: 'Invalid client credentials. Verify the OAuth client secret and ID.',
      signupFailed: 'The request to create a scratch org failed with error code: %s.',
      signupFailedUnknown:
        'An unknown server error occurred. Please try again. If you still see this error, contact Salesforce support for assistance. Include the information from "sfdx force:data:record:get -s ScratchOrgInfo -i %s -u %s".',
      signupFailedAction:
        'See https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_signuprequest.htm for information on error code %s.',
      signupUnexpected: 'The request to create a scratch org returned an unexpected status',
      signupFieldsMissing: 'Required fields are missing for org creation: [%s]',
      signupDuplicateSettingsSpecified:
        "You cannot use 'settings' and `'orgPreferences' in your scratch definition file, please specify one or the other.",

      pushCommandAsyncRequestInvalidated:
        'Salesforce cancelled the job because the results might not be valid. Is there a newer compile request?',
      pushCommandAsyncRequestUnexpected: 'An unexpected error occurred during deploy.',
      pushCommandCliInvalidUsernameOption: 'Invalid value for username',
      pullCommandConflictMsg:
        'We couldn’t complete the pull operation due to conflicts. Verify that you want to keep the remote versions, then run "sfdx force:source:pull -f" with the --forceoverwrite (-f) option.',

      MissingMetadataExtension:
        "Expected file at path: %s to end with the '-meta.xml' extension. Please rename the file to %s",
      MissingMetadataFileWithMetaExt: "Expected metadata file with '-meta.xml' extension at path: %s",
      MissingMetadataFile: 'Expected metadata file at path: %s',
      MissingContentFile: 'Expected content file(s) at path(s): %s',
      MissingContentOrMetadataFile: 'Expected file at path: %s',
      UnsupportedMimeTypes: 'The following MIME types are not supported: %s',

      statusCommandCliDescription: 'list local changes and/or changes in a scratch org',
      statusCommandCliLongDescription: 'Lists changes that have been made locally, in a scratch org, or both.',
      statusCommandCliHelp:
        'Examples:' +
        '\n   $ sfdx force:source:status -l' +
        '\n   $ sfdx force:source:status -r' +
        '\n   $ sfdx force:source:status -a' +
        '\n   $ sfdx force:source:status -a -u me@example.com --json',
      statusCommandAllOptionDescription: 'list all the changes that have been made',
      statusCommandAllOptionDescriptionLong: 'Lists all the changes that have been made.',
      statusCommandLocalOptionDescription: 'list the changes that have been made locally',
      statusCommandLocalOptionDescriptionLong: 'Lists the changes that have been made locally.',
      statusCommandRemoteOptionDescription: 'list the changes that have been made in the scratch org',
      statusCommandRemoteOptionDescriptionLong: 'Lists the changes that have been made in the scratch org.',
      statusCommandHumanSuccess: 'Source Status',

      mdapiPullCommandNoDataReturned: 'No metadata was returned by the retrieve',

      // mdapi general-purpose messages
      mdapiCliWaitTimeExceededError:
        'Your %s request did not complete within the specified wait time [%s minutes]. Try again with a longer wait time.',
      mdapiCliExclusiveFlagError: 'Specify either --%s or --%s but not both.',
      mdapiCliInvalidWaitError:
        'Specify the number of minutes to wait as a numerical value greater than or equal to -1. You can specify a decimal value if it is greater than 0.',
      mdapiDeployFailed: 'The metadata deploy operation failed.',
      mdapiDeployCanceled: 'The metadata deploy operation was canceled.',

      // mdapi main topic short and long descriptions
      mdapiTopicDescription: 'retrieve and deploy metadata using Metadata API',
      mdapiTopicLongDescription:
        'Use the mdapi commands to retrieve and deploy Metadata API–formatted files that ' +
        'represent components in an org, or to convert Metadata API–formatted metadata into the source format used in ' +
        'Salesforce DX projects.',

      // mdapi:deploy messages
      mdDeployCommandCliInvalidUsernameOption:
        'That target username doesn’t exist. Try again with a valid target username.',
      mdDeployCommandCliZipFileError: 'The --zipfile parameter requires a file path to a zip file. Try again.',
      mdDeployCommandCliWaitTimeExceededError:
        'The deploy request did not complete within the specified wait time [%s minutes].\n' +
        'To check the status of this deployment, run "sfdx force:mdapi:deploy:report"',
      mdDeployCommandCliInvalidJobIdError: 'The job for [%s] doesn’t exist. Try again with a valid job ID.',
      mdDeployCommandCliInvalidRequestIdError:
        'The value [%s] provided for ID is not valid. It should be 15 or 18 characters long.',
      mdDeployCommandCliNoRestDeploy:
        'REST deploy is not available for this org. This feature is currently for internal Salesforce use only.',

      // mdapi:describemetadata
      mdDescribeMetadataCommandCliDescription: 'display the metadata types enabled for your org',
      mdDescribeMetadataCommandCliLong:
        'Displays details about metadata types enabled for your org. Use this information to identify the ' +
        'syntax needed for a <name> element in package.xml. The most recent API version is the default, or you can specify an older version.',
      mdDescribeMetadataCommandCliHelp:
        'The default target username is the admin user for the default scratch org. The username must have ' +
        'the Modify All Data permission or the Modify Metadata permission (Beta). For more information about permissions, see Salesforce Help.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:mdapi:describemetadata -a 43.0' +
        '\n   $ sfdx force:mdapi:describemetadata -u me@example.com' +
        '\n   $ sfdx force:mdapi:describemetadata -f /path/to/outputfilename.txt' +
        '\n   $ sfdx force:mdapi:describemetadata -u me@example.com -f /path/to/outputfilename.txt',
      mdDescribeMetadataCommandCliApiVersion: 'API version to use (the default is %s)',
      mdDescribeMetadataCommandCliApiVersionLong: 'The API version to use. The default is the latest API version (%s).',
      mdDescribeMetadataCommandCliResultFile: 'path to the file where results are stored',
      mdDescribeMetadataCommandCliResultFileLong:
        'The path to the file where the results of the command are stored. Directing the output to a file makes it easier to extract relevant information for your package.xml manifest file. The default output destination is the console.',
      mdDescribeMetadataCommandCliFilterKnown: 'filter metadata known by the CLI',
      mdDescribeMetadataCommandCliFilterKnownLong:
        'Filters all the known metadata from the result such that all that is left are the types not yet fully supported by the CLI.',
      mdDescribeMetadataCommandCliInvalidApiVersionError:
        'To display metadata from an earlier API version, use --apiversion and specify a positive numerical value less than or equal to the current API version (%s).',

      // mdapi:listmetadata
      mdListmetadataCommandCliDescription: 'display properties of metadata components of a specified type',
      mdListmetadataCommandCliLong:
        'Displays properties of metadata components of a specified type. This call is useful when you want to identify ' +
        'individual components in your manifest file or if you want a high-level view of particular components in your organization. ' +
        'For example, you could use this target to return a list of names of all Layout components in your org, then use this information in a retrieve operation that returns a subset of these components.',
      mdListmetadataCommandCliHelp:
        'The default target username is the admin user for the default scratch org.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:mdapi:listmetadata -m CustomObject' +
        '\n   $ sfdx force:mdapi:listmetadata -m CustomObject -a 43.0' +
        '\n   $ sfdx force:mdapi:listmetadata -m CustomObject -u me@example.com' +
        '\n   $ sfdx force:mdapi:listmetadata -m CustomObject -f /path/to/outputfilename.txt' +
        '\n   $ sfdx force:mdapi:listmetadata -m Dashboard --folder foldername' +
        '\n   $ sfdx force:mdapi:listmetadata -m Dashboard --folder foldername -a 43.0' +
        '\n   $ sfdx force:mdapi:listmetadata -m Dashboard --folder foldername -u me@example.com' +
        '\n   $ sfdx force:mdapi:listmetadata -m Dashboard --folder foldername -f /path/to/outputfilename.txt' +
        '\n   $ sfdx force:mdapi:listmetadata -m CustomObject -u me@example.com -f /path/to/outputfilename.txt',
      mdListmetadataCommandCliApiVersion: 'API version to use (the default is %s)',
      mdListmetadataCommandCliApiVersionLong: 'The API version to use. The default is the latest API version (%s).',
      mdListmetadataCommandCliResultFile: 'path to the file where results are stored',
      mdListmetadataCommandCliResultFileLong:
        'The path to the file where the results of the command are stored. The default output destination is the console.',
      mdListmetadataCommandCliInvalidApiVersionError:
        'To display metadata from an earlier API version, use --apiversion and specify a positive numerical value less than or equal to the current API version (%s).',
      mdListmetadataCommandCliMetadatatype:
        'metadata type to be retrieved, such as CustomObject; metadata type value is case-sensitive',
      mdListmetadataCommandCliMetadatatypeLong:
        'The metadata type to be retrieved, such as CustomObject or Report. The metadata type value is case-sensitive.',
      mdListmetadataCommandCliFolder:
        'folder associated with the component; required for components that use folders; folder names are case-sensitive',
      mdListmetadataCommandCliFolderLong:
        'The folder associated with the component. This parameter is required for components that use folders, such as Dashboard, Document, EmailTemplate, or Report. The folder name value is case-sensitive.',

      // mdapi:retrieve messages
      mdRetrieveCommandCliInvalidUsernameOption:
        'That target username doesn’t exist. Try again with a valid target username.',
      mdRetrieveCommandCliWaitTimeExceededError:
        'The retrieve request did not complete within the specified wait time [%s minutes].\n' +
        'To check the status of this retrieve, run "sfdx force:mdapi:retrieve:report%s"',
      mdRetrieveCommandCliTooManyPackagesError:
        'You specified [%s]. Try again and specify only one package when using --singlepackage.',
      mdRetrieveCommandCliInvalidProjectError:
        'You can’t create a manifest from an artifact when you’re not in a project. ' +
        'Move into a valid project or specify the manifest location using a parameter (--packagenames, --unpackaged).',
      mdRetrieveCommandCliInvalidApiVersionError:
        'Specify the API version as a positive numerical value less than or equal to the current API version (%s).',

      mdapiRetrieveFailed: 'The metadata retrieve operation failed: %s',

      pollTimeout: 'polling timeout in milliseconds (default %s ms)',
      pollInterval: 'polling interval in milliseconds (default %s ms)',
      waitParamValidValueError:
        'Invalid value was specified for wait. Please provide a wait value greater than %s minutes.',

      orgTopicDescription: 'manage your orgs',
      orgTopicDescriptionLong:
        'Use the org commands to manage the orgs you use with Salesforce CLI. Create and delete scratch orgs, ' +
        'list your created and authorized orgs, and open orgs in your browser.',

      orgShapeTopicDescription: 'manage your org shapes',
      orgShapeTopicDescriptionLong:
        'Use the org:shape commands to manage the org shapes you use with Salesforce CLI. Create and delete org shapes, ' +
        'and list your created org shapes.',

      accessTokenLoginUrlNotSet:
        'The instance URL is not set, or is incorrect for the given access token. API Error: %s',

      userTopicDescription: 'perform user-related admin tasks',
      userTopicDescriptionLong: 'Use the user commands to perform user-related admin tasks.',

      pullCommandMetadataTypeLabel: 'Metadata Type',
      pullCommandMetadataTypePath: 'Metadata Path',
      pullCommandCliPreExecute: 'Pulling source changes from org %s as user %s',
      pullCommandHumanSuccess: 'Pulled Source',

      packageCliDescription: 'develop and install packages',
      packageCliDescriptionLong: 'Use the package commands to develop and install packages.',

      package1CliDescription: 'develop first-generation managed and unmanaged packages',
      package1CliDescriptionLong:
        'Use the package1 commands to create and view first-generation package versions in your Dev Hub org.',

      package1VersionCreateCommandCliDescription: 'create a first-generation package version in the release org',
      package1VersionCreateCommandCliDescriptionLong: 'Creates a first-generation package version in the release org.',
      package1VersionCreateCommandCliHelp:
        'The package version is based on the contents of the specified metadata package. Omit -m if you want to create an unmanaged package version.',
      package1VersionCreateCommandId:
        'ID of the metadata package (starts with 033) of which you’re creating a new version',
      package1VersionCreateCommandIdLong:
        'ID of the metadata package (starts with 033) of which you’re creating a new version.',
      package1VersionCreateCommandName: 'package version name',
      package1VersionCreateCommandNameLong: 'Package version name.',
      package1VersionCreateCommandDescription: 'package version description',
      package1VersionCreateCommandDescriptionLong: 'Package version description.',
      package1VersionCreateCommandVersion: 'package version in major.minor format, for example, 3.2',
      package1VersionCreateCommandVersionLong: 'Package version in major.minor format, for example, 3.2.',
      package1VersionCreateCommandReleaseNotes: 'release notes URL',
      package1VersionCreateCommandReleaseNotesLong:
        'The release notes URL. This link is displayed in the package installation UI to provide release notes ' +
        'for this package version to subscribers.',
      package1VersionCreateCommandPostInstall: 'post install URL',
      package1VersionCreateCommandPostInstallLong:
        'The post-install instructions URL. The contents of the post-installation instructions URL are displayed ' +
        'in the UI after installation of the package version.',
      package1VersionCreateCommandManagedReleased: 'create a managed package version',
      package1VersionCreateCommandManagedReleasedLong:
        'Creates a managed package version. To create a beta version, don’t include this parameter.',
      package1VersionCreateCommandInstallationKey: 'installation key for key-protected package (default: null)',
      package1VersionCreateCommandInstallationKeyLong:
        'Installation key for creating the key-protected package. The default is null.',
      package1VersionCreateCommandWait: 'minutes to wait for the package version to be created (default: 2 minutes)',
      package1VersionCreateCommandWaitLong:
        'Minutes to wait for the package version to be created. The default is 2 minutes.',
      package1VersionCreateCommandNotANumber: 'Field %s must contain only a numeric value: %s.',
      package1VersionCreateCommandInvalidVersion:
        'Version supplied, %s, is not formatted correctly. Enter in major.minor format, for example, 3.2.',
      package1VersionCreateCommandTimeout:
        'Stopped waiting for package upload to finish. Wait time exceeded. waitTimeInMinutes = %s.',
      package1VersionCreateCommandUploadFailure: `Package upload failed. ${os.EOL}%s`,
      package1VersionCreateCommandUploadFailureDefault: 'Package version creation failed with unknown error',
      package1VersionCreateHumanSuccess: 'Successfully created package version: %s for package %s.',

      package1VersionListCommandLongDescription:
        'Lists the versions for the specified package or all first-generation packages in the org.',
      package1VersionListCommandCliDescription:
        'list package versions for the specified first-generation package or for the org',
      package1VersionListCommandCliHelp:
        'If a metadata package ID is specified, lists all versions of the specified package. ' +
        'Otherwise, lists all package versions for the org. For each package version, the list includes the package ' +
        'version ID, metadata package ID, name, version number, and release state.',
      package1VersionListCommandPackageId: 'metadata package ID (starts with 033)',
      package1VersionListCommandPackageIdLong:
        'Metadata package ID (starts with 033) whose package versions you want to list. If not specified, shows all versions for all packages (managed and unmanaged) in the org.',
      package1VersionListHumanSuccess: 'Successfully created the package version list.',
      package1VersionListAction:
        'Verify that you entered a valid package ID and that you are authorized in the org. Then try again.',

      package1VersionDisplayCommandLongDescription:
        'Displays detailed information about an individual first-generation package version.',
      package1VersionDisplayCommandCliDescription: 'display details about a first-generation package version',
      package1VersionDisplayCommandCliHelp:
        'Display detailed information about an individual package version, including metadata package ID, name, the release state, and build number.',
      package1VersionDisplayCommandPackageId: 'metadata package version ID (starts with 04t)',
      package1VersionDisplayCommandPackageIdLong:
        'ID (starts with 04t) of the metadata package version whose details you want to display.',
      package1VersionDisplayHumanSuccess: 'Successfully displayed the package version.',
      package1VersionDisplayAction: 'Verify that you entered a valid package version ID and try again.',
      package2VersionUpdateSetAsReleasedYesNo:
        "Are you sure you want to release package version %s? You can't undo this action. Release package (y/n)?", // PACKAGE 2 LEGACY
      packageVersionUpdateSetAsReleasedYesNo:
        "Are you sure you want to release package version %s? You can't undo this action. Release package (y/n)?",
      attemptingToDeleteExpiredOrDeleted: 'Attempting to delete an expired or deleted org',
      insufficientAccessToDelete:
        'You do not have the appropriate permissions to delete a scratch org. Please contact your Salesforce admin.',
      deleteOrgConfigOnlyCommandSuccess: 'Successfully deleted scratch org %s.',
      deleteOrgCommandSuccess: 'Successfully marked scratch org %s for deletion',
      deleteOrgCommandQueryError: 'Error querying for DevHubMember %s. We received %s results',
      deleteOrgCommandPathError: 'The scratch org config for scratch org %s does not exist',
      deleteOrgHubError: 'The Dev Hub org cannot be deleted.',
      logoutOrgCommandSuccess: 'Successfully logged out of orgs.',
      defaultOrgNotFound: 'No %s org found',
      defaultOrgNotFoundAction:
        'Run the "sfdx force:auth" commands with --setdefaultusername to connect to an org and set it ' +
        'as your default org.\nRun "force:org:create" with --setdefaultusername to create a scratch org and set it as ' +
        'your default org.\nRun "sfdx force:config:set defaultusername=<username>" to set your default username.',
      defaultOrgNotFoundDevHubAction:
        'Run the "sfdx force:auth" commands with --setdefaultdevhubusername to connect to a ' +
        'Dev Hub org and set it as your default Dev Hub.\nRun "force:org:list" to see a list of locally registered orgs.' +
        '\nRun "sfdx force:config:set defaultdevhubusername=<username>" to set your default Dev Hub username.',
      namedOrgNotFound: 'No org configuration found for name %s',
      noResultsFound: 'No results found',
      invalidVersionString: 'Invalid API version string.',
      fullNameIsRequired: 'The fullName attribute is required.',
      metadataTypeIsRequired: 'The metadata type attribute is required.',
      unexpectedSmmToolingFullNameFormat: 'Unexpected format for FullName: %s.',
      invalidResponseFromQuery: 'Invalid response from query: %s.',

      keyChainServiceCommandFailed: 'Command failed with response.\n%s',
      keyChainServiceRequired: 'Can’t get or set a keychain value without a service name.',
      keyChainAccountRequired: 'Can’t get or set a keychain value without an account name.',
      keyChainPasswordNotFound: 'Could not find password.',
      keyChainUserCanceled: 'User canceled authentication',
      keyChainCredentialParseError: 'A parse error occurred while setting a credential.',
      keychainGetCommandFailedAction: 'Determine why this command failed to get an encryption key for user %s: [%s].',
      keychainSetCommandFailedAction: 'Determine why this command failed to set an encryption key for user %s: [%s].',
      keychainPasswordNotFoundAction: 'Ensure a valid password is returned with the following command: [%s].',
      retrieveKeyChainItemFailedAction:
        'Ensure that user %s has a login keychain item named %s. If not re-run authorization.',
      genericUnixKeychainInvalidPerms: 'Invalid file permissions for secret file',
      genericUnixKeychainInvalidPermsAction: 'Ensure the file %s has the file permission octal value of %s.',
      genericUnixKeychainServiceAccountMismatch:
        'The service and account specified in %s do not match the version of the toolbelt.',
      genericUnixKeychainServiceAccountMismatchAction: 'Check your toolbelt version and re-auth.',
      dataExportInvalidSoql: 'Invalid SOQL query: %s',
      dataExportSoqlFailed: 'Error invoking SOQL query: %s',
      dataExportFailed: 'Export failed for soql query: %s. Error: %s.',
      dataExportQueryMalformed: 'The provided SOQL is malformed: %s',
      dataExportQueryMalformedAction: 'Check the SOQL syntax and try again.',
      dataExportRecordCount: 'Processed %s records from query: %s',
      dataExportRecordCountWarning:
        'Query returned more than 200 records. Please run the command using the plan option instead.\n Record Count: %s \nQuery: %s',
      dataExportSoqlNotProvided: 'Provide a SOQL query statement or file containing a SOQL statement.',
      dataImportFileNotProvided: 'Provide a data plan or file(s).',
      dataImportFileNotFound: 'Cannot find data file. Indicate a valid path: %s.',
      dataImportFileUnknownContentType: 'Unable to determine content type for file: %s.',
      dataImportFileUnsupported: 'Content type: %s not supported.',
      dataImportTooManyFiles: 'Specify either sobjecttreefiles or a plan, but not both.',
      dataImportFileEmpty: 'Data file is empty: %s.',
      dataImportFileInvalidJson: 'data file is invalid JSON: %s',
      dataImportFileNoRefId:
        'Found references in file, but no reference-id content found (%s). Was parent SObjects saved first?',
      dataImportFailed: 'Import failed from file: %s. Results: %s.',

      sourceConflictDetected: 'Source conflict(s) detected.',
      oauthInvalidGrant:
        'This org appears to have a problem with its OAuth configuration. Reason: %s \nusername: %s, \nclientId: %s, \nloginUrl: %s, \nprivateKey: %s',
      oauthInvalidGrantAction:
        'Verify the OAuth configuration for this org. For JWT:' +
        `${os.EOL}Ensure the private key is correct and the cert associated with the connected app has not expired.` +
        `${os.EOL}Ensure the following OAuth scopes are configured [api, refresh_token, offline_access].` +
        `${os.EOL}Ensure the username is assigned to a profile or perm set associated with the connected app.` +
        `${os.EOL}Ensure the connected app is configured to pre-authorize admins.`,
      notSpecified: '<Not Specified>',
      warnApiVersion: 'apiVersion configuration overridden at %s',
      metadataTypeNotSupported:
        'We can’t retrieve the specified metadata object: %s. Certain metadata types, like %s are not currently supported by the CLI.\n' +
        'File a bug here: https://github.com/forcedotcom/cli/issues and provide the name of the unsupported metadata type',
      shapeCreateFailedMessage: 'Error creating scratch definition file. Please contact Salesforce support.'
    }
  },
  IndexErrorProcessor: {
    en_US: {
      apiMisMatch: 'The configured apiVersion %s is not supported for this org. The max apiVersion is %s',
      apiMisMatchAction:
        'Run "sfdx force" to see if the locally configured apiVersion is same or less than the org’s supported max apiVersion.' +
        `${os.EOL}Run "sfdx force:config:list" to determine if apiVersion is overridden.` +
        `${os.EOL}Install the latest version of the salesforcedx plug-in by running sfdx plugins:install salesforcedx@latest.`,
      server500:
        'The salesforce.com servers are temporarily unable to respond to your request. We apologize for the inconvenience.' +
        `${os.EOL}Thank you for your patience, and please try again in a few moments.`,
      server500Action: 'Visit http://trust.salesforce.com for current system status and availability.'
    }
  },

  apex: {
    en_US: {
      apexTestApiReportHint: 'Run "sfdx force:apex:test:report %s" to retrieve test results.',
      apexTestApiReportForFormatHint:
        'Run "sfdx force:apex:test:report %s --resultformat <format>" to retrieve test results in a different format.',
      apexTestApiReportHintWithTimeoutAction:
        'Run "sfdx force:apex:test:report -i %s" to retrieve the test results. Or increase the streaming timeout by specifying the wait parameter.',
      description: 'work with Apex code',
      longDescription:
        'Use the apex commands to create Apex classes, execute anonymous blocks, view your logs, run Apex tests, and view Apex test results.',
      apexCommandParamCodeCoverage: 'retrieve code coverage results',
      apexCommandParamCodeCoverageLong: 'Retrieves code coverage results.',
      apexCommandParamTestArtifactDir: 'directory to store test run files',
      apexCommandParamTestArtifactDirLong: 'Directory to store test run files.',
      apexTestCommandDescription: 'invoke Apex tests',
      apexTestCommandDescriptionLong: 'Runs Apex tests.',
      apexTestCommandHelp:
        'By default, runs all Apex tests in the org’s namespace.' +
        '\n\nTo run specific test classes, specify class names or suite names, or set a --testlevel value.' +
        '\n\nTo run specific test methods, use --tests.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:apex:test:run' +
        '\n   $ sfdx force:apex:test:run -n "MyClassTest,MyOtherClassTest" -r human' +
        '\n   $ sfdx force:apex:test:run -s "MySuite,MyOtherSuite" -c --json' +
        '\n   $ sfdx force:apex:test:run -t "MyClassTest.testCoolFeature,MyClassTest.testAwesomeFeature,AnotherClassTest,namespace.TheirClassTest.testThis" -r human' +
        '\n   $ sfdx force:apex:test:run -l RunLocalTests -d <path to outputdir> -u me@my.org',
      apexTestCommandParamTestNames: 'comma-separated list of Apex test class names to run',
      apexTestCommandParamTestNamesLong:
        'Comma-separated list of Apex test class names to run. You can specify only one of ' +
        'classnames, suitenames, or tests.',
      apexTestCommandParamTestSuites: 'comma-separated list of Apex test suite names to run',
      apexTestCommandParamTestSuitesLong:
        'Comma-separated list of Apex test suite names to run. You can only specify one of ' +
        'classnames, suitenames, or tests.',
      apexTestCommandParamTests:
        'comma-separated list of Apex test class names or IDs and, if applicable, test methods to run',
      apexTestCommandParamTestsLong:
        'Comma-separated list of Apex test class names or IDs and test methods, if applicable, ' +
        'to run. You can only specify one of classnames, suitenames, or tests.',
      apexTestCommandParamTestLevel: 'testlevel enum value',
      apexTestCommandParamTestLevelLong:
        'Specifies which tests to run, using one of these TestLevel enum values:' +
        '\nRunSpecifiedTests—Only the tests that you specify are run.' +
        '\nRunLocalTests—All tests in your org are run, except the ones that originate from installed managed packages.' +
        '\nRunAllTestsInOrg—All tests are in your org and in installed managed packages are run.',
      apexTestCommandParamReporter: 'test result format emitted to stdout; --json flag overrides this parameter',
      apexTestCommandParamReporterLong:
        'Format to use when displaying test results. If you also specify the --json flag, --json overrides this parameter.',
      apexTestCommandParamSynchronous: 'run tests from a single class synchronously',
      apexTestCommandParamSynchronousLong:
        "Runs test methods from a single Apex class synchronously. If you don't specify this flag, tests are run asynchronously.",
      apexTestCommandResultFormatDeprecation:
        'In salesforcedx v41 and earlier, the --resultformat parameter caused the ' +
        'apex:test:run command to wait for test results rather than finishing immediately and returning a test run ID. In salesforcedx v42 and later, the --resultformat parameter will no longer cause the command to wait. To wait for test results, include the --wait parameter.',
      apexTestCommandInvalidTestlevel:
        'To use the testlevel value RunSpecifiedTests, specify either classnames or suitenames.',
      apexTestCommandInvalidSynchronousParams:
        'Synchronous test runs can include test methods from only one Apex class. Omit the --synchronous flag or include tests from only one class.',
      apexTestSynchronousRunFailed: 'Unable to run tests synchronously: [%s]',

      apexReportCommandDescription: 'display test results',
      apexReportCommandDescriptionLong: 'Displays the test results for a specific test run.',
      apexReportCommandHelp:
        'Displays test results for an enqueued or completed asynchronous Apex test run.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:apex:test:report -i <test run id>' +
        '\n   $ sfdx force:apex:test:report -i <test run id> -r junit' +
        '\n   $ sfdx force:apex:test:report -i <test run id> -c --json',
      apexReportCommandParamTestRunId: 'ID of test run',
      apexReportCommandParamTestRunIdLong: 'The ID of test run.',
      apexReportCommandParamReporter: 'test result format emitted to stdout; --json flag overrides this parameter',
      apexReportCommandParamReporterLong:
        'Format to use when displaying test results. If you also specify the --json flag, --json overrides this parameter.',
      apexReportImprovedCoverageWarning:
        "In Summer '20, the Apex test reporter will return more relevant and accurate code coverage results for test runs. To preview this change, set the environment variable SFDX_IMPROVED_CODE_COVERAGE='true'. Learn more at https://releasenotes.docs.salesforce.com/en-us/spring20/release-notes/rn_sf_cli_code_coverage_apextests.htm",
      invalidValueForSocketTimeoutHandler: 'provide a valid function for the socket timeout handler.',
      verboseDescription: 'display Apex test processing details',
      verboseLongDescription:
        'Displays Apex test processing details. If JSON format is specified, processing details aren’t displayed.'
    }
  },

  apexPreCompile: {
    en_US: {
      missingOrg: 'Invalid or missing org.',
      precompileTimedOut: 'The precompile operation timed out.',
      precompileTimedOutAction: 'Increase the timeout attribute and try again.',
      precompileQueryError: 'An error occurred querying the state of the Apex cache - %s',
      precompileWarmerError: 'An error occurred running Apex pre-compilation - %s',
      invalidTimeout: 'Timeout value must be greater than zero.',
      invalidPollInterval: 'Poll interval must be greater than zero.'
    }
  },

  apexPreCompileCommand: {
    en_US: {
      invalidTimeout: 'Invalid timeout value. Value must be greater than %s minutes.',
      precompileDescription: 'how long to wait (in minutes) for Apex pre-compilation',
      precompileLongDescription:
        'Specifies how long to wait (in minutes) for Apex pre-compilation to complete before running the tests or timing out.'
    }
  },

  demoMode: {
    en_US: {
      warnAuth:
        'Logging in to a business or production org is not recommended on a demo or shared machine. ' +
        'Please run "sfdx force:auth:logout --targetusername <your username> --noprompt"' +
        ` when finished using this org, which is similar to logging out of the org in the browser.${os.EOL}` +
        `${os.EOL}Do you want to authorize this org, %s, for use with the Salesforce CLI? `,
      warnAuthWebLogin:
        'A response of "n" lets you keep using the org in the browser, but doesn\'t save authorization ' +
        'details on this computer. ',
      warnAuthQuestion: `${os.EOL}Authorize org (y/n)?`,
      noPrompt: 'do not prompt for auth confirmation in demo mode',
      noPromptLong: 'Do not prompt for auth confirmation in demo mode.',
      demoModeCloseBrowser:
        "Your auth information wasn't stored by the Salesforce CLI. Please log out of your browser session" +
        " when you're finished using this org."
    }
  },

  auth: {
    en_US: {
      description: 'authorize an org for use with the Salesforce CLI',
      longDescription: 'Use the auth commands to authorize a Salesforce org for use with the Salesforce CLI.',
      clientId: 'OAuth client ID (sometimes called the consumer key)',
      clientIdLong: 'The OAuth client ID (sometimes referred to as the consumer key).',
      setDefaultDevHub: 'set the authenticated org as the default dev hub org for scratch org creation',
      setDefaultDevHubLong: 'Sets the authenticated org as the default Dev Hub org for scratch org creation.',
      setDefaultUsername: 'set the authenticated org as the default username that all commands run against',
      setDefaultUsernameLong: 'Sets the authenticated org as the default username that all commands run against.',
      setAlias: 'set an alias for the authenticated org',
      setAliasLong: 'Sets an alias for the authenticated org.',
      instanceUrl: 'the login URL of the instance the org lives on',
      instanceUrlLong: 'The login URL of the Salesforce instance that the org lives on.',
      deviceWarning:
        "force:auth:web:login doesn't work when authorizing to a headless environment. Use force:auth:device:login instead."
    }
  },

  auth_weblogin: {
    en_US: {
      help:
        'To log in to a sandbox, set --instanceurl to https://test.salesforce.com.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:auth:web:login -a TestOrg1' +
        '\n   $ sfdx force:auth:web:login -i <OAuth client id>' +
        '\n   $ sfdx force:auth:web:login -r https://test.salesforce.com',
      description: 'authorize an org using the web login flow',
      longDescription: 'Authorizes a Salesforce org by opening a browser so you can log in through salesforce.com.',
      stdin: 'OAuth client secret of personal connected app?',
      disableMasking: 'disable masking of user input (for use with problematic terminals)',
      disableMaskingLong: 'Disables masking of user input (for use with problematic terminals).'
    }
  },

  auth_logout: {
    en_US: {
      help:
        'By default, this command logs you out from your default scratch org.' +
        `${os.EOL}Examples:` +
        `${os.EOL}   $ sfdx force:auth:logout -u me@my.org` +
        `${os.EOL}   $ sfdx force:auth:logout -a` +
        `${os.EOL}   $ sfdx force:auth:logout -p`,
      description: 'log out from authorized orgs',
      longDescription: 'Logs you out from one or all of your authorized Salesforce orgs.',
      noPrompt: 'do not prompt for confirmation',
      noPromptLong: 'Do not prompt for confirmation.',
      all: 'include all authenticated orgs',
      allLong:
        'Includes all authenticated orgs: for example, Dev Hubs, sandboxes, DE orgs, and expired, deleted, and unknown-status scratch orgs.',
      logoutCommandYesNo:
        `Are you sure you want to log out from these org(s)?%s${os.EOL}${os.EOL}` +
        'Important: You need a password to reauthorize scratch orgs. By default, scratch orgs have no password. If you still need your scratch orgs, run ' +
        '"sfdx force:user:password:generate" before logging out. If you don\'t need the scratch orgs anymore, run "sfdx force:org:delete" instead of logging out.' +
        `${os.EOL}${os.EOL}Log out (y/n)?`,
      specifiedBothUserAndAllError: 'Specify either --targetusername or --all.'
    }
  },

  auth_jwt: {
    en_US: {
      help:
        'Authorizes a Salesforce org using a certificate associated with your private key that has been uploaded to a personal connected app.' +
        '\n\nIf you specify an --instanceurl value, this value overrides the sfdcLoginUrl value ' +
        'in your sfdx-project.json file. To specify a My Domain URL, use the format ' +
        'MyDomainName.my.salesforce.com (not MyDomainName.lightning.force.com).' +
        '\n\nExamples:' +
        '\n   $ sfdx force:auth:jwt:grant -u me@my.org -f <path to jwt key file> -i <OAuth client id>' +
        '\n   $ sfdx force:auth:jwt:grant -u me@my.org -f <path to jwt key file> -i <OAuth client id> -s -a MyDefaultOrg' +
        '\n   $ sfdx force:auth:jwt:grant -u me@acme.org -f <path to jwt key file> -i <OAuth client id> -r https://acme.my.salesforce.com',
      description: 'authorize an org using the JWT flow',
      longDescription: 'Authorizes a Salesforce org using the JWT flow.',
      username: 'authentication username',
      usernameLong: 'The authentication username.',
      key: 'path to a file containing the private key',
      keyLong: 'Path to a file containing the private key.'
    }
  },

  auth_sfdxurl: {
    en_US: {
      description: 'authorize an org using an SFDX auth URL',
      longDescription: 'Authorizes a Salesforce org using an SFDX auth URL.',
      help:
        'Authorize a Salesforce org using an SFDX auth URL stored within a file.' +
        '\nThe file must have the format "%s" or "%s".' +
        '\nThe file must contain only the URL or be a JSON file that has a top-level property named sfdxAuthUrl.' +
        '\nUse this command to get the SFDX auth URL for a Dev Hub org you have already authorized:' +
        '\n\n    $ sfdx force:org:display -u <DevHub> --verbose' +
        '\n\nExamples:' +
        '\n   $ sfdx force:auth:sfdxurl:store -f <path to sfdxAuthUrl file>' +
        '\n   $ sfdx force:auth:sfdxurl:store -f <path to sfdxAuthUrl file> -s -a MyDefaultOrg',
      file: 'path to a file containing the sfdx url',
      fileLong: 'Path to a file containing the SFDX URL.',
      InvalidSfdxAuthUrl:
        'Invalid or missing SFDX auth URL.' +
        '\nEnsure the file exists, and that it either a) contains only the URL, or ' +
        'b) is a JSON file with a top-level property named sfdxAuthUrl.' +
        '\nEnsure the URL is in the correct format "%s" or "%s".'
    }
  },

  varargs_command: {
    en_US: {
      ArgsRequired: 'Please provide required name=value pairs for the command, quoting any values containing spaces.',
      InvalidArgsFormat:
        'Setting variables must be in the format <key>=<value> or <key>="<value with spaces>" but found %s.',
      DuplicateArgs: "Cannot set variable name '%s' twice for the same command."
    }
  },

  alias: {
    en_US: {
      description: 'manage username aliases',
      longDescription: 'Use the alias commands to manage username aliases.',
      NoAliasesFound: 'Nothing to set',
      InvalidFormat: 'Setting aliases must be in the format <key>=<value> but found: [%s]'
    }
  },

  sfdxConfig: {
    en_US: {
      invalidConfigValue: 'Invalid config value. %s',
      invalidApiVersion: 'Specify a valid Salesforce API version, for example, 42.0.',
      invalidInstanceUrl: 'Specify a valid Salesforce instance URL.',
      UnknownConfigKey: 'Unknown config key: %s',
      sfdxProjectValidationFailure: 'sfdx-project.json file did not validate against the schema.'
    }
  },

  data: {
    en_US: {
      description: 'manipulate records in your org',
      longDescription:
        'Use the data commands to manipulate records in your org. Commands are available to help you work with ' +
        'various APIs. Import CSV files with the Bulk API. Export and import data that includes master-detail relationships with ' +
        'the SObject Tree Save API. Perform simple CRUD operations on individual records with the REST API.',

      dataImportCommandCliDescription: 'import data into an org using SObject Tree Save API',
      dataImportCommandCliDescriptionLong:
        'Imports data into an org using the SObject Tree Save API. This data can include ' +
        'master-detail relationships.',
      dataImportCommandCliHelp:
        'To generate JSON files for use with force:data:tree:import, run "sfdx force:data:tree:export".' +
        '\n\nExamples:\nTo import records as individual files, first run the export commands:' +
        '\n   $ sfdx force:data:tree:export -q "SELECT Id, Name FROM Account"' +
        '\n   $ sfdx force:data:tree:export -q "SELECT Id, LastName, FirstName FROM Contact"' +
        '\nThen run the import command:' +
        '\n   $ sfdx force:data:tree:import -f Contact.json,Account.json -u me@my.org' +
        '\n\nTo import multiple data files as part of a plan, first run the export command with the -p | --plan flag:' +
        '\n   $ sfdx force:data:tree:export -p -q "SELECT Id, Name, (SELECT Id, LastName, FirstName FROM Contacts) FROM Account"' +
        '\nThen run the import command, supplying a filepath value for the -p | --plan parameter:' +
        '\n   $ sfdx force:data:tree:import -p Account-Contact-plan.json -u me@my.org' +
        '\n\nThe SObject Tree API supports requests that contain up to 200 records. For more information, see the REST API ' +
        'Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm',
      dataImportCommandCliFiles:
        'comma-delimited, ordered paths of json files containing collection of record trees to insert',
      dataImportCommandCliFilesLong:
        'Comma-delimited, ordered paths of JSON files containing a collection of record trees to insert. ' +
        'Either --sobjecttreefiles or --plan is required.',
      dataImportCommandCliContentType:
        'if data file extension is not .json, provide content type (applies to all files)',
      dataImportCommandCliContentTypeLong:
        'If the data file extension is not .json, provide the content type (applies to all files).',
      dataImportCommandCliPlan: 'path to plan to insert multiple data files that have master-detail relationships',
      dataImportCommandCliPlanLong:
        'Path to plan to insert multiple data files that have master-detail relationships. ' +
        'Either --sobjecttreefiles or --plan is required.',
      dataImportCommandValidationFailure:
        'Data plan file %s did not validate against the schema.' +
        '\nDid you run the force:data:tree:export command with the --plan flag?' +
        '\nMake sure you are importing a plan file.' +
        '\nYou can get help with the import plan schema by running $ sfdx force:data:tree:import --confighelp' +
        '\n\n%s',
      dataExportCommandCliDescription:
        'export data from an org into sObject tree format for force:data:tree:import consumption',
      dataExportCommandCliDescriptionLong:
        'Exports data from an org into sObject tree format for force:data:tree:import consumption.',
      dataExportCommandCliHelp:
        'Generates JSON files for use with the force:data:tree:import command.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:data:tree:export -q "SELECT Id, Name, (SELECT Name, Address__c FROM Properties__r) FROM Broker__c"' +
        '\n   $ sfdx force:data:tree:export -q <path to file containing soql query> -x export-demo -d /tmp/sfdx-out -p' +
        '\n\nFor more information and examples, run "sfdx force:data:tree:import -h".' +
        '\n\nThe query for export can return a maximum of 2,000 records. For more information, see the REST API ' +
        'Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm',
      dataExportCommandCliSoql: 'soql query, or filepath of file containing a soql query, to retrieve records',
      dataExportCommandCliSoqlLong:
        'A SOQL query statement or the path of a file containing a SOQL query statement ' +
        'to retrieve the records to export.',
      dataExportCommandCliPrefix: 'prefix of generated files',
      dataExportCommandCliPrefixLong: 'Prefix of generated files.',
      dataExportCommandCliDir: 'directory to store files',
      dataExportCommandCliDirLong: 'Directory to store generated files.',
      dataExportCommandCliPlan: 'generate mulitple sobject tree files and a plan definition file for aggregated import',
      dataExportCommandCliPlanLong:
        'Generates multiple sObject tree files and a plan definition file for aggregated import.'
    }
  },

  versionCommand: {
    en_US: {
      versionDescription: 'display the Salesforce API version',
      MissingVersionAttribute: 'Missing version attribute from package.json',
      UnexpectedVersionFormat: 'The version specified in package.json is unexpected: %s'
    }
  },

  mdapiConvertCommand: {
    en_US: {
      description: 'convert metadata from the Metadata API format into the source format',
      longDescription:
        'Converts metadata retrieved via Metadata API into the source format used in Salesforce DX projects.',
      help:
        'To use Salesforce CLI to work with components that you retrieved via Metadata API, ' +
        'first convert your files from the metadata format to the source format using "sfdx force:mdapi:convert".' +
        '\n\nTo convert files from the source format back to the metadata format, so that you can deploy them ' +
        'using "sfdx force:mdapi:deploy", run "sfdx force:source:convert".' +
        '\n\nExamples:' +
        '\n   $ sfdx force:mdapi:convert -r path/to/metadata' +
        '\n   $ sfdx force:mdapi:convert -r path/to/metadata -d path/to/outputdir',
      rootParam: 'the root directory containing the Metadata API–formatted metadata',
      rootParamLongDescription: 'The root directory that contains the metadata you retrieved using Metadata API.',
      outputDirectoryParam: 'the output directory to store the source–formatted files',
      outputDirectoryParamLongDescription:
        'The directory to store your files in after they’re converted to the ' +
        'source format. Can be an absolute or relative path.',
      tableName: 'Converted Source',
      tableNameDups: 'Duplicates',
      dupsExplanation:
        'Review any duplicate files (.dup) in the destination directory. You may need to merge the files. Otherwise, delete the unneeded one. Duplicate files are ignored by the force:source commands.',
      manifestLongDescription:
        'The complete path to the manifest (package.xml) file that specifies the metadata types to convert.' +
        '\nIf you specify this parameter, don’t specify --metadata or --sourcepath.',
      manifestDescription: 'file path to manifest (package.xml) of metadata types to convert.',
      sourcePathDescription: 'comma-separated list of paths to the local source files to convert',
      sourcePathLongDescription:
        'A comma-separated list of paths to the local source files to convert. ' +
        'The supplied paths can be to a single file (in which case the operation is applied to only one file) or to a folder ' +
        '(in which case the operation is applied to all metadata types in the directory and its sub-directories).' +
        '\nIf you specify this parameter, don’t specify --manifest or --metadata.' +
        'If the comma-separated list you’re supplying contains spaces, enclose the entire comma-separated list in one set of double quotes.',
      metadataParamDescription: 'comma-separated list of metadata component names to convert',
      metadataParamLongDescription: 'A comma-separated list of metadata component names to convert.'
    }
  },

  mdapiConvertApi: {
    en_US: {
      invalidPath: 'the path specified is not a directory or doesn’t contain a package.xml',
      errorProcessingPath: 'An error was encountered processing path: %s'
    }
  },

  scratchOrgApi: {
    en_US: {
      noOrgsFound: 'No orgs can be found.',
      noOrgsFoundAction: 'Use one of the commands in force:auth or force:org:create to add or create new scratch orgs.'
    }
  },

  org_shape_list: {
    en_US: {
      description: 'list all org shapes you’ve created',
      longDescription: 'Lists all org shapes that you’ve created using the Salesforce CLI.',
      verbose: 'list more information about each org shape',
      verboseLong: 'Lists more information about each org shape.',
      noOrgShapes: 'No org shapes found.',
      help:
        'Examples:' +
        '\n   $ sfdx force:org:shape:list' +
        '\n   $ sfdx force:org:shape:list --json' +
        '\n   $ sfdx force:org:shape:list --json > tmp/MyOrgShapeList.json'
    }
  },

  org_shape_delete: {
    en_US: {
      description: 'delete all org shapes for a target org',
      longDescription: 'Deletes all org shapes that you’ve created for an org using the Salesforce CLI.',
      verbose: 'list more information about each org shape',
      verboseLong: 'Lists more information about each org shape.',
      usernameOption: 'username for the target org',
      usernameOptionLong: 'Username for the target org.',
      targetUsernameOption: 'username for the target org',
      targetUsernameOptionLong: 'Username for the target org.',
      noPrompt: 'do not prompt for confirmation',
      noPromptLong: 'Do not prompt for confirmation.',
      noAccess: 'The org with name: %s needs to be enabled for org shape before shapes can be deleted.',
      deleteCommandYesNo: 'Delete shapes for org with name: %s?  Are you sure (y/n)?',
      humanSuccess: 'Successfully deleted org shape for %s.',
      noShapesHumanSuccess: "Can't delete org shape. No org shape found for org %s.",
      help:
        'Examples:' +
        '\n   $ sfdx force:org:shape:delete -u me@my.org' +
        '\n   $ sfdx force:org:shape:delete -u MyOrgAlias -p' +
        '\n   $ sfdx force:org:shape:delete -u me@my.org --json' +
        '\n   $ sfdx force:org:shape:delete -u me@my.org -p --json > tmp/MyOrgShapeDelete.json'
    }
  },

  org_shape_get: {
    en_US: {
      description: 'retrieve an org shape',
      longDescription: 'Retrieves an org shape that you created from an org using Salesforce CLI.',
      notAShapeId: 'the value passed in was not a shape id'
    }
  },

  package_displayancestry: {
    en_US: {
      cliDescription: 'display the ancestry tree for a 2GP managed package version',
      cliDescriptionLong: 'Displays the ancestry tree for a 2GP managed package version.',
      help:
        'Examples:\n' +
        '   $ sfdx force:package:version:displayancestry -p package_version_alias\n' +
        '   $ sfdx force:package:version:displayancestry -p package_version_alias --dotcode\n' +
        '   $ sfdx force:package:version:displayancestry -p OHo...\n' +
        '   $ sfdx force:package:version:displayancestry -p 04t...',
      package:
        'ID or alias of the package (starts with 0Ho) or package version (starts with 04t) to display ancestry for',
      packageLong:
        'The ID or alias of the package or package version to display ancestry for. If you specify a package ID (starts with 0Ho) or alias, the ancestor tree for every package version associated with the package ID is displayed.\n' +
        'If you specify a package version (starts with 04t) or alias, the ancestry tree of the specified package version is displayed.',
      dotcode: 'display the ancestry tree in DOT code',
      dotcodeLong:
        'Displays the ancestry tree in DOT code. You can use the DOT code output in graph visualization software to create tree visualizations.',
      verbose:
        'display both the package version ID (starts with 04t) and the version number (major.minor.patch.build) in the ancestry tree',
      verboseLong:
        'Displays both the package version ID (starts with 04t) and the version number (major.minor.patch.build) in the ancestry tree.',
      invalidId:
        'Can’t display the ancestry tree for %s. Specify a valid package ID (starts with 0Ho) or package version ID (starts with 04t), and try creating the ancestry tree again.',
      parseError:
        'Can’t display the ancestry tree. The specified package alias can’t be located. Check that you’re running this CLI command from the DX project directory, and try creating the ancestry tree again.',
      versionNotFound:
        'Can’t display the ancestry tree for %s. Verify the package version number (starts with 04t) or the package version alias listed in the sfdx-project.json file, and try creating the ancestry tree again.',
      invalidAlias:
        'Can’t display the ancestry tree for %s. The specified package alias can’t be found. Verify the package alias name listed in the sfdx-project.json, or specify the package ID or package version ID, and try creating the ancestry tree again.',
      unlockedPackageError:
        'Can’t display package ancestry. Package ancestry is available only for second-generation managed packages. Retry this command and specify a second-generation managed package or package version.',
      noVersionsError:
        'Can’t display package ancestry. The specified package has no associated released package versions. Retry this command after you create and promote at least one package version.'
    }
  },

  package_install_get: {
    en_US: {
      cliDescription: 'retrieve the status of a package installation request',
      cliDescriptionLong: 'Retrieves the status of a package installation request.',
      help:
        'Examples:' +
        '\n   $ sfdx force:package:install:get -i 0Hf...' +
        '\n   $ sfdx force:package:install:get -i 0Hf... -u me@example.com',
      requestId: 'ID of the package install request you want to check',
      requestIdLong: 'The ID of the package install request you want to check.',
      IN_PROGRESS:
        'PackageInstallRequest is currently InProgress. You can continue to query the status using' +
        '\nsfdx force:package:install:get -i %s -u %s',
      UNKNOWN: this.InProgress,
      SUCCESS: 'Successfully installed package [%s]'
    }
  },

  package_uninstall_get: {
    en_US: {
      cliDescription: 'retrieve the status of a package uninstall request',
      cliDescriptionLong: 'Retrieves the status of a package uninstall request.',
      help:
        'Examples:' +
        '\n   $ sfdx force:package:uninstall:get -i 06y...' +
        '\n   $ sfdx force:package:uninstall:get -i 06y... -u me@example.com',
      requestId: 'ID of the package uninstall request you want to check',
      requestIdLong: 'The ID of the package uninstall request you want to check.',
      InProgress:
        'PackageUninstallRequest is currently InProgress. You can continue to query the status using' +
        '\nsfdx force:package:uninstall:get -i %s -u %s',
      Unknown: this.InProgress,
      Success: 'Successfully uninstalled package [%s]'
    }
  },

  package_install_report: {
    en_US: {
      cliDescription: 'retrieve the status of a package installation request',
      cliDescriptionLong: 'Retrieves the status of a package installation request.',
      help:
        'Examples:' +
        '\n   $ sfdx force:package:install:report -i 0Hf...' +
        '\n   $ sfdx force:package:install:report -i 0Hf... -u me@example.com',
      requestId: 'ID of the package install request you want to check',
      requestIdLong: 'The ID of the package install request you want to check.',
      IN_PROGRESS:
        'PackageInstallRequest is currently InProgress. You can continue to query the status using' +
        '\nsfdx force:package:install:report -i %s -u %s',
      UNKNOWN: this.InProgress,
      SUCCESS: 'Successfully installed package [%s]'
    }
  },

  package_uninstall_report: {
    en_US: {
      cliDescription: 'retrieve status of package uninstall request',
      cliDescriptionLong: 'Retrieves the status of a package uninstall request.',
      help:
        'Examples:' +
        '\n   $ sfdx force:package:uninstall:report -i 06y...' +
        '\n   $ sfdx force:package:uninstall:report -i 06y... -u me@example.com',
      requestId: 'ID of the package uninstall request you want to check',
      requestIdLong: 'The ID of the package uninstall request you want to check.',
      InProgress:
        'PackageUninstallRequest is currently InProgress. You can continue to query the status using' +
        '\nsfdx force:package:uninstall:report -i %s -u %s',
      Unknown: this.InProgress,
      Success: 'Successfully uninstalled package [%s]'
    }
  },

  package1_version_create_get: {
    en_US: {
      cliDescription: 'retrieve the status of a package version creation request',
      cliDescriptionLong: 'Retrieves the status of a package version creation request.',
      help:
        'Examples:' +
        '\n   $ sfdx force:package:version:create:report -i 08c...' +
        '\n   $ sfdx force:package:version:create:report -i 08c... -v devhub@example.com',
      requestId: 'PackageUploadRequest ID',
      requestIdLong: 'The ID of the PackageUploadRequest.',
      IN_PROGRESS:
        'PackageUploadRequest is still InProgress. You can query the status using' +
        '\nsfdx force:package1:version:create:get -i %s -u %s',
      SUCCESS: 'Successfully uploaded package [%s]',
      QUEUED:
        'PackageUploadRequest has been enqueued. You can query the status using' +
        '\nsfdx force:package1:version:create:get -i %s -u %s'
    }
  },

  package_install: {
    en_US: {
      cliDescription: 'install a package in the target org',
      cliDescriptionLong: 'Installs a package in the target org.',
      help:
        'Supply the ID of the package version to install. ' +
        'The package installs in your default target org unless ' +
        'you supply the username for a different target org.' +
        '\n\nFor package upgrades, to specify options for component deprecation ' +
        'or deletion of removed components, include an --upgradetype value. ' +
        'To delete components that can be safely deleted and deprecate the ' +
        'others, specify --upgradetype Mixed (the default). To deprecate all ' +
        'removed components, specify --upgradetype DeprecateOnly. To delete all removed components, ' +
        "except for custom objects and custom fields, that don't have dependencies, specify " +
        '--upgradetype Delete. (Note: This option can result in the loss of data that is associated with the deleted components.) ' +
        'The default is Mixed.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:install --package 04t... -u me@example.com' +
        '\n   $ sfdx force:package:install --package awesome_package_alias' +
        '\n   $ sfdx force:package:install --package "Awesome Package Alias"' +
        '\n   $ sfdx force:package:install --package 04t... -t DeprecateOnly',
      id: 'ID of the package version to install (starts with 04t)',
      idLong: 'The ID of the package version to install (starts with 04t).',
      wait: 'number of minutes to wait for installation status',
      waitLong: 'Maximum number of minutes to wait for installation status. The default is 0.',
      installationKey: 'installation key for key-protected package (default: null)',
      installationKeyLong: 'Installation key for installing a key-protected package. The default is null.',
      noPrompt: 'do not prompt for confirmation',
      noPromptLong:
        'Allows the following without an explicit confirmation response: 1) Remote Site Settings and Content Security Policy websites to send or receive data, ' +
        'and 2) --upgradetype Delete to proceed.',
      promptRss:
        'This package might send or receive data from these third-party websites:\n\n' +
        '%s' +
        '\n\nGrant access (y/n)?',
      promptUpgradeType:
        "The Delete upgrade type permanently deletes metadata types that have been removed from the package. Deleted metadata can’t be recovered. We don't delete custom objects and custom fields. Instead, we deprecate them." +
        '\n\nDo you want to continue? (y/n)',
      promptUpgradeTypeDeny: 'We canceled this package installation per your request.',
      publishWait: 'number of minutes to wait for subscriber package version ID to become available in the target org ',
      publishWaitLong:
        'Maximum number of minutes to wait for the Subscriber Package Version ID to become available ' +
        'in the target org before canceling the install request. The default is 0.',
      humanSuccess: 'Successfully installed package ID %s.',
      publishWaitProgress: 'Waiting for the Subscriber Package Version ID to be published to the target org.',
      errorApvIdNotPublished:
        'The package version is not fully available. If this is a recently created package ' +
        'version, try again in a few minutes or contact the package publisher.',
      package: 'ID (starts with 04t) or alias of the package version to install',
      packageLong: 'The ID (starts with 04t) or alias of the package version to install.',
      securityType:
        'security access type for the installed package (deprecation notice: The default --securitytype value will change from AllUsers to AdminsOnly in v47.0 or later.)',
      securityTypeLong:
        "Security access type for the installed package.\nDeprecation notice: The --securitytype parameter's default value will change from AllUsers to AdminsOnly in an upcoming release (v47.0 or later).",
      upgradeType: 'the upgrade type for the package installation; available only for unlocked packages',
      upgradeTypeLong:
        'For package upgrades, specifies whether to mark all removed components as deprecated (DeprecateOnly), ' +
        'to delete removed components that can be safely deleted and deprecate the others (Mixed), ' +
        "or to delete all removed components, except for custom objects and custom fields, that don't have dependencies (Delete). " +
        'The default is Mixed. Can specify DeprecateOnly or Delete only for unlocked package upgrades.',
      apexCompile: 'compile all Apex in the org and package, or only Apex in the package; unlocked packages only',
      apexCompileLong:
        'Applies to unlocked packages only. Specifies whether to compile all Apex in the org and package, or only the Apex in the package.',
      errorRequiredFlags: 'Include either a %s value or a %s value.',
      invalidIdOrPackage:
        'Invalid alias or ID: %s. Either your alias is invalid or undefined, or the ID provided is invalid.',
      deprecateSecurityTypeDefault:
        "[Deprecation notice: The --securitytype parameter's default value will change from AllUsers to AdminsOnly in an upcoming release (v47.0 or later).]"
    }
  },
  package_version_promote: {
    en_US: {
      cliDescription: 'promote a package version to released',
      cliDescriptionLong: 'Promotes a package version to released status.',
      help:
        'Supply the ID or alias of the package version you want ' +
        'to promote. Promotes the package version to released status.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:version:promote -p 04t...' +
        '\n   $ sfdx force:package:version:promote -p awesome_package_alias' +
        '\n   $ sfdx force:package:version:promote -p "Awesome Package Alias"',
      package: 'ID (starts with 04t) or alias of the package version to promote',
      packageLong: 'The ID (starts with 04t) or alias of the package version to promote.',
      packageVersionPromoteSetAsReleasedYesNo:
        "Are you sure you want to release package version %s? You can't undo this action. Release package (y/n)?",
      setasreleasedForce: 'no prompt to confirm setting the package version as released',
      setasreleasedForceLong: 'Do not prompt to confirm setting the package version as released.',
      humanSuccess:
        'Successfully promoted the package version, ID: %s, to released. Starting in Winter ‘21, only unlocked package versions that have met the minimum 75% code coverage requirement can be promoted. Code coverage minimums aren’t enforced on org-dependent unlocked packages.',
      previouslyReleasedMessage:
        'You already promoted a package version with this major.minor.patch version number. For a given major.minor.patch number, you can promote only one version.',
      previouslyReleasedAction:
        'Create a new package version with a different --versionumber, then promote the package version.\n' +
        'sfdx force:package:version:create -p <name> -n <versionnum> -k <key>\n' +
        'sfdx force:package:version:promote -p 05ixxx'
    }
  },
  package_uninstall: {
    en_US: {
      cliDescription: 'uninstall a second-generation package from the target org',
      cliDescriptionLong:
        'Uninstalls a second-generation package from ' +
        'the target org. To uninstall a first-generation package, ' +
        'use the Salesforce user interface.',
      help:
        'Specify the package ID for a second-generation package.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:uninstall -p 04t... -u me@example.com' +
        '\n   $ sfdx force:package:uninstall -p undesirable_package_alias' +
        '\n   $ sfdx force:package:uninstall -p "Undesirable Package Alias"' +
        '\n\nTo list the org’s installed packages, run ' +
        '"sfdx force:package:installed:list".' +
        '\n\nTo uninstall a first-generation package, from Setup, ' +
        'enter Installed Packages in the Quick Find box, then ' +
        'select Installed Packages.',
      id: 'ID of the package to uninstall (starts with 04t)',
      idLong: 'The ID of the second-generation package to uninstall (starts with 04t).',
      wait: 'number of minutes to wait for uninstall status',
      waitLong: 'Maximum number of minutes to wait for uninstall status. The default is 0.',
      defaultErrorMessage: "Can't uninstall the package %s during uninstall request %s.",
      humanSuccess: 'Successfully uninstalled package ID %s.',
      action: 'Verify installed package ID and resolve errors, then try again.',
      package: 'ID (starts with 04t) or alias of the package version to uninstall',
      packageLong: 'The ID (starts with 04t) or alias of the package version to uninstall.',
      errorRequiredFlags: 'Include either a %s value or a %s value.',
      invalidIdOrPackage:
        'Invalid alias or ID: %s. Either your alias is invalid or undefined, or the ID provided is invalid.'
    }
  },

  packaging: {
    en_US: {
      topicHelp: 'develop, install, and manage packages',
      topicHelpLong: 'Use the package commands to develop, install, and manage packages.',
      createdLastDaysDescription:
        'created in the last specified number of days (starting at 00:00:00 of first day to now; 0 for today)',
      createdLastDaysLongDescription:
        'Filters the list based on the specified maximum number of days since the request was created ' +
        '(starting at 00:00:00 of first day to now; 0 for today).',
      modifiedLastDaysDescription:
        'list items modified in the specified last number of days (starting at 00:00:00 of first day to now; 0 for today)',
      modifiedLastDaysLongDescription:
        'Lists the items modified in the specified last number of days, starting at 00:00:00 of first day to now. Use 0 for today.',
      invalidIdOrAlias:
        "The %s: %s isn't defined in the sfdx-project.json. Add it to the packageDirectories section and add the alias to packageAliases with its %s ID.",
      invalidDaysNumber: 'Provide a valid positive number for %s.',
      invalidStatus: "Invalid status '%s'.  Please provide one of these statuses: %s",
      packageNotEnabledAction:
        'Packaging is not enabled on this org. Verify that you are authenticated to the desired org and try again. Otherwise, contact Salesforce Customer Support for more information.',
      packageInstanceNotEnabled:
        'Your org does not have permission to specify a build instance for your package version. Verify that you are authenticated to the desired org and try again. Otherwise, contact Salesforce Customer Support for more information.',
      packageSourceOrgNotEnabled:
        'Your Dev Hub does not have permission to specify a source org for your build org. Verify that you are authenticated to the correct Dev Hub and try again. Otherwise, contact Salesforce Customer Support for assistance.',
      installStatus: 'Waiting for the package install request to complete. Status = %s',
      errorMissingVersionNumber: 'The VersionNumber property must be specified.',
      errorInvalidVersionNumber:
        'VersionNumber must be in the format major.minor.patch.build but the value found is [%s].',
      errorInvalidBuildNumber:
        "The provided VersionNumber '%s' is invalid. Provide an integer value or use the keyword '%s' for the build number.",
      errorInvalidPatchNumber: "The provided VersionNumber '%s' is not supported. Provide a patch number of 0.",
      errorInvalidMajorMinorNumber:
        "The provided VersionNumber '%s' is invalid. Provide an integer value for the %s number.",
      errorInvalidAncestorVersionFormat:
        'The ancestor versionNumber must be in the format major.minor.patch but the value found is [%s].',
      errorNoMatchingAncestor: "The ancestorId for ancestorVersion [%s] can't be found. Package ID [%s].",
      errorAncestorNotReleased:
        'The ancestor package version [%s] specified in the sfdx-project.json file hasn’t been promoted and released. Release the ancestor package version before specifying it as the ancestor in a new package or patch version.',
      errorAncestorIdVersionMismatch:
        'The ancestorVersion in sfdx-project.json is not the version expected for the ancestorId you supplied. ancestorVersion [%s]. ancestorID [%s].',
      errorpackageAncestorIdsKeyNotSupported:
        'The package2AncestorIds key is no longer supported in a scratch org definition. Ancestors defined in sfdx-project.json will be included in the scratch org.',
      errorInvalidIdNoMatchingVersionId: 'The %s %s is invalid, as a corresponding %s was not found',
      errorIdTypeMismatch: 'ID type mismatch: an ID of type %s is required, but an ID of type %s was specified: %s',
      updatedSfdxProject: 'sfdx-project.json has been updated.',
      errorSfdxProjectFileWrite:
        'sfdx-project.json could not be updated with the following entry for this package: \n%s\nReason: %s\n',
      invalidPackageTypeAction: 'Specify Unlocked or Managed for package type.',
      invalidPackageTypeMessage: 'Invalid package type',
      idNotFoundAction:
        'It`s possible that this package was created on a different Dev Hub. Authenticate to the Dev Hub org that owns the package, and reference that Dev Hub when running the command.',
      malformedPackageVersionIdAction: 'Use "sfdx force:package:version:list" to verify the 05i package version ID.',
      malformedPackageVersionIdMessage: 'We can’t find this package version ID for this Dev Hub.',
      malformedPackageIdAction: 'Use "sfdx force:package:list" to verify the 0Ho package version ID.',
      malformedPackageIdMessage: 'We can’t find this package ID for this Dev Hub.'
    }
  },

  // Is this used anywhere? It seems like a duplicate.
  package_install_request: {
    en_US: {
      cliDescription: '(deprecated) retrieve the status of a package install request',
      cliDescriptionLong: 'Retrieves the status of a package installion request.',
      help:
        'Examples:' +
        '\n   $ sfdx force:package:install:get -i 0Hf...' +
        '\n   $ sfdx force:package:install:get -i 0Hf... -u me@example.com',
      requestId: 'Package Installation Request ID',
      requestIdLong: 'ID of the package install request.',
      IN_PROGRESS:
        'The package installation request is still In Progress or Unknown. You can query the status using ' +
        '\n $ sfdx force:package:install:get -i %s -u %s',
      UNKNOWN: this.InProgress,
      SUCCESS: 'Successfully installed package [%s].'
    }
  },
  package_convert: {
    en_US: {
      cliDescription: 'creates a second-generation package version from a first-generation package',
      cliLongDescription:
        'Creates a second-generation package in the Dev Hub from a first-generation package in the Dev Hub org.',
      help:
        'The package convert creates a new package in the Dev Hub if one does not already exist for the specified first-generation package.' +
        '\n\nIt then creates a new package version in the Dev Hub with contents based on the specified first-generation package.' +
        '\n\nThe latest released non-patch package version from the specified first-generation package will be converted.' +
        '\n\nTo retrieve details about a package version create request, including status and package version ID (04t), ' +
        'run "sfdx force:package:version:create:report -i 08c...".' +
        '\n\nWe recommend specifying the --installationkey to protect the contents of your package and to prevent unauthorized installation of your package.' +
        '\n\nTo list package version creation requests in the org, run "sfdx force:package:version:create:list".' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:convert --package 033xx0000004Gmn -k password123',
      package: 'ID (starts with 033) of the first-generation package to convert',
      longPackage: 'The ID (starts with 033) or alias of the package to convert.',
      key:
        'installation key for key-protected package (either ' +
        '--installationkey or --installationkeybypass is required)',
      longKey:
        'Installation key for creating the key-protected ' +
        'package. Either an --installationkey value or the ' +
        '--installationkeybypass flag is required.',
      keyBypass:
        'bypass the installation key requirement (either ' +
        '--installationkey or --installationkeybypass is required)',
      longKeyBypass:
        'Bypasses the installation key requirement. ' +
        'If you bypass this requirement, anyone can install your package. ' +
        'Either an --installationkey value or the ' +
        '--installationkeybypass flag is required.',
      wait: 'minutes to wait for the package version to be created',
      longWait: 'The number of minutes to wait for the package version to be created.',
      instance: 'the instance where the conversion package version will be created——for example, NA50',
      longInstance: 'The instance where the conversion package version will be created——for example, NA50.',
      errorMoreThanOnePackage2WithSeed:
        'Only one package in in a Dev Hub is allowed per converted from first-generation package, but the following were found: ',
      errorNoSubscriberPackageRecord: 'No subscriber package was found for seed id: '
    }
  },
  package_create: {
    en_US: {
      cliDescription: 'create a package',
      cliLongDescription: 'Creates a package.',
      help:
        'First, use this command to create a package. Then create a package version.' +
        '\n\nIf you don’t have a namespace defined in your sfdx-project.json file, use --nonamespace.' +
        '\n\nYour --name value must be unique within your namespace.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:create -n YourPackageName -t Unlocked -r force-app' +
        '\n   $ sfdx force:package:create -n YourPackageName -d "Your Package Descripton" -t Unlocked -r force-app' +
        "\n\nRun 'sfdx force:package:list' to list all packages in the Dev Hub org.",
      name: 'package name',
      nameLong: 'Name of the package to create.',
      orgDependent: 'depends on unpackaged metadata in the installation org. Applies to unlocked packages only.',
      orgDependentLong:
        'Package depends on unpackaged metadata in the installation org. Applies to unlocked packages only.' +
        '\nUse Source Tracking in Sandboxes to develop your org-dependent unlocked package.' +
        '\nFor more information, see "Create Org-Dependent Unlocked Packages" in the Salesforce DX Developer Guide.',
      errorNotificationUsername: 'active Dev Hub user designated to receive email notifications for package errors',
      errorNotificationUsernameLong:
        'An active Dev Hub org user designated to receive email notifications for unhandled Apex exceptions, and install, upgrade, or uninstall failures associated with your package.',
      description: 'package description',
      descriptionLong: 'Description of the package.',
      noNamespace: 'creates the package with no namespace; available only for unlocked packages.',
      noNamespaceLong:
        'Creates the package with no namespace. Available only for unlocked packages. ' +
        'Useful when you’re migrating an existing org to packages. ' +
        'But, use a namespaced package for new metadata.',
      packageType: 'package type',
      packageTypeLong:
        'Package type for the package.' +
        '\nThe options for package type are Managed and Unlocked ' +
        '(Managed=DeveloperManagedSubscriberManaged, Unlocked=DeveloperControlledSubscriberEditable).' +
        '\nThese options determine upgrade and editability rules.',
      path: 'path to directory that contains the contents of the package',
      longPath: 'The path to the directory that contains the contents of the package.',
      errorPathNotSpecified:
        'Add a valid path to packageDirectories in the sfdx-project.json file. ' +
        'When the --path parameter is specified, the path is automatically added to the sfdx-project.json file.\n%s\n',
      humanSuccess: 'Successfully created a package.'
    }
  },

  package_update: {
    en_US: {
      cliDescription: 'update package details',
      cliLongDescription: 'Updates details about a package. Does not create a package version.',
      help:
        'Specify a new value for each option you want to update.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:update -p "Your Package Alias" -n "New Package Name"' +
        '\n   $ sfdx force:package:update -p 0Ho... -d "New Package Description"' +
        '\n\nRun "sfdx force:package:list" to list all packages in the Dev Hub org.',
      package: 'ID (starts with 0Ho) or alias of the package to update',
      packageLong: 'The ID (starts with 0Ho) or alias of the package to update.',
      name: 'new package name',
      nameLong: 'New name of the package.',
      description: 'new package description',
      descriptionLong: 'New description of the package.',
      humanSuccess: 'Successfully updated the package.'
    }
  },

  package_list: {
    en_US: {
      cliDescription: 'list all packages in the Dev Hub org',
      cliLongDescription: 'Lists all packages in the Dev Hub org.',
      help:
        'You can view the namespace, IDs, and other details for each package.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:list -v devhub@example.com' +
        '\n   $ sfdx force:package:list -v devhub@example.com --verbose',
      namespace: 'Namespace Prefix',
      name: 'Name',
      id: 'Id',
      packageId: 'Subscriber Package Id',
      alias: 'Alias',
      description: 'Description',
      packageType: 'Type',
      verboseDescription: 'display extended package detail',
      verboseLongDescription: 'Displays extended package details.',
      convertedFromPackageId: 'Converted From Package Id',
      isOrgDependent: 'Org-Dependent Unlocked Package',
      errorNotificationUsername: 'Error Notification Username'
    }
  },

  package_version_create: {
    en_US: {
      cliDescription: 'create a package version',
      cliLongDescription: 'Creates a package version in the Dev Hub org.',
      help:
        'The package version is based on the package contents in the specified directory.' +
        '\n\nTo retrieve details about a package version create request, including status and package version ID (04t), ' +
        'run "sfdx force:package:version:create:report -i 08c...".' +
        '\n\nWe recommend that you specify the --installationkey parameter to protect the contents of your package and to prevent unauthorized installation of your package.' +
        '\n\nTo list package version creation requests in the org, run "sfdx force:package:version:create:list".' +
        '\n\nTo promote a package version to released, you must use the --codecoverage parameter. The package must also meet the code coverage requirements. This requirement applies to both managed and unlocked packages.' +
        '\n\nWe don’t calculate code coverage for org-dependent unlocked packages, or for package versions that specify --skipvalidation.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:version:create -d common -k password123' +
        '\n   $ sfdx force:package:version:create -p "Your Package Alias" -k password123' +
        '\n   $ sfdx force:package:version:create -p 0Ho... -k password123' +
        '\n   $ sfdx force:package:version:create -d common -k password123 --skipvalidation',
      package: 'ID (starts with 0Ho) or alias of the package to create a version of',
      longPackage: 'The ID (starts with 0Ho) or alias of the package to create a version of.',
      path: 'path to directory that contains the contents of the package',
      longPath: 'The path to the directory that contains the contents of the package.',
      definitionfile:
        'path to a definition file similar to scratch org definition file that contains the list of features ' +
        'and org preferences that the metadata of the package version depends on',
      longDefinitionfile:
        'The path to a definition file similar to scratch org definition file that contains the list of features ' +
        'and org preferences that the metadata of the package version depends on.',
      dir: 'path to directory that contains the contents of the package version',
      longDir: 'The path to the directory that contains the contents of the package version.',
      branch: 'the package version’s branch',
      longBranch: 'The package version’s branch.',
      tag: 'the package version’s tag',
      longTag: 'The package version’s tag.',
      key:
        'installation key for key-protected package (either ' +
        '--installationkey or --installationkeybypass is required)',
      longKey:
        'Installation key for creating the key-protected ' +
        'package. Either an --installationkey value or the ' +
        '--installationkeybypass flag is required.',
      keyBypass:
        'bypass the installation key requirement (either ' +
        '--installationkey or --installationkeybypass is required)',
      longKeyBypass:
        'Bypasses the installation key requirement. ' +
        'If you bypass this requirement, anyone can install your package. ' +
        'Either an --installationkey value or the ' +
        '--installationkeybypass flag is required.',
      preserve: 'temp files are preserved that would otherwise be deleted',
      longPreserve: 'Specifies that the temp files are preserved that would otherwise be deleted',
      validateschema: 'sfdx-project.json is validated against JSON schema',
      longValidateschema: 'Specifies that the sfdx-project.json file should be validated against JSON schema.',
      tempFileLocation: 'The temp files are located at: %s.',
      wait: 'minutes to wait for the package version to be created',
      longWait: 'The number of minutes to wait for the package version to be created.',
      instance: 'the instance where the package version will be created——for example, NA50',
      longInstance: 'The instance where the package version will be created——for example, NA50.',
      sourceorg: 'the source org ID used to copy the org shape for the build org',
      longSourceorg: 'The source org ID used to copy the org shape for the build org.',
      versionname: 'the name of the package version to be created',
      longVersionname: 'The name of the package version to be created. Overrides the sfdx-project.json value.',
      versionnumber: 'the version number of the package version to be created',
      longVersionnumber:
        'The version number of the package version to be created. Overrides the sfdx-project.json value.',
      versiondescription: 'the description of the package version to be created',
      longVersiondescription:
        'The description of the package version to be created. Overrides the sfdx-project.json value.',
      codeCoverage: 'calculate the code coverage by running the packaged Apex tests',
      longCodeCoverage:
        'Calculate and store the code coverage percentage by running the Apex tests included in this package version. ' +
        'Before you can promote and release a managed or unlocked package version, the Apex code must meet a minimum 75% code coverage requirement. ' +
        'We don’t calculate code coverage for org-dependent unlocked packages or for package versions that specify --skipvalidation.',
      releaseNotesUrl: 'release notes URL',
      releaseNotesUrlLong:
        'The release notes URL. This link is displayed in the package installation UI to provide release notes ' +
        'for this package version to subscribers.',
      skipValidation: 'skip validation during package version creation; you can’t promote unvalidated package versions',
      skipValidationLong:
        'Skips validation of dependencies, package ancestors, and metadata during package version creation. Skipping validation reduces ' +
        'the time it takes to create a new package version, but you can promote only validated package versions. Skipping validation ' +
        'can suppress important errors that can surface at a later stage. You can specify ' +
        'skip validation or code coverage, but not both. Code coverage is calculated during validation.',
      skipValidationWarning:
        'Skipping validation suppresses errors that usually surface during package version creation. Instead, ' +
        'these errors surface at a later stage, such as installation or post-installation. If you encounter errors that ' +
        'are difficult to debug, retry package version creation without the skipvalidation parameter.',
      hasMetadataRemovedWarning:
        "The package version you've created doesn't contain metadata components that were in the package version's ancestor.",
      postInstallUrl: 'post-install URL',
      postInstallUrlLong:
        'The post-install instructions URL. The contents of the post-installation instructions URL are displayed ' +
        'in the UI after installation of the package version.',
      postInstallScript: 'post-install script name; managed packages only',
      postInstallScriptLong:
        'Applies to managed packages only. The post-install script name. The post-install script is an Apex class ' +
        'within this package that is run in the installing org after installations or upgrades of this package version.',
      uninstallScript: 'uninstall script name; managed packages only',
      uninstallScriptLong:
        'Applies to managed packages only. The uninstall script name. The uninstall script is an Apex class within this ' +
        'package that is run in the installing org after uninstallations of this package.',
      defaultVersionName:
        'versionName is blank in sfdx-project.json, so it will be set to this default value based on the versionNumber: %s',
      InProgress:
        'Package version creation request status is \'%s\'. Run "sfdx force:package:version:create:report -i %s" to query for status.',
      Success:
        'Successfully created the package version [%s]. Subscriber Package Version Id: %s' +
        '\nPackage Installation URL: %s%s' +
        '\nAs an alternative, you can use the "sfdx force:package:install" command.',
      errorMissingFlags:
        'Include either a %s value or a %s value. The value must match one of the packageDirectories specified in sfdx-project.json.',
      errorCannotSupplyCodeCoverageAndSkipValidation:
        'We couldn’t create this package version because both %s and %s parameters were specified. Code coverage ' +
        'can’t be calculated when validation is skipped. Specify either %s or %s and try again.',
      errorMissingFlagsInstallationKey: 'A required parameter is missing. Include either an %s value or %s.',
      errorNoMatchingPackageDirectory:
        'The %s value [%s], doesn’t match the %s value in any packageDirectories specified in sfdx-project.json.',
      errorDirectoryIdMismatch:
        'The %s value, [%s], and %s value, [%s], ' +
        'were both found in sfdx-project.json but don’t match. ' +
        'If you supply both values, they must match the path and ' +
        'package values in one of the packageDirectories.',
      errorDependencyPair:
        'Dependency must specify either a subscriberPackageVersionId or both packageId and versionNumber: %s.',
      errorNoIdInHub: 'No package ID was found in Dev Hub for package ID: %s.',
      errorPackageAndPackageIdCollision:
        'You can’t have both "package" ' + 'and "packageId" (deprecated) defined as dependencies in sfdx-project.json.',
      errorPackageAndIdCollision:
        'You can’t have both "package" and ' + '"id" (deprecated) defined in your sfdx-project.json file.',
      errorMissingPackage:
        'The package %s isn’t defined in the sfdx-project.json file. ' +
        'Add it to the packageDirectories section and add the alias to packageAliases with its 0Ho ID.',
      errorEmptyPackageDirs:
        'sfdx-project.json must contain a packageDirectories entry for a package. You can run the force:package:create command to auto-populate such an entry.',
      errorProfileUserLicensesInvalidValue:
        'Can’t create package version. Check your sfdx-project.json file and set includeProfileUserLicenses to either true or false. Then try package version creation again.',
      unknownError: 'Package version creation failed with unknown error.',
      malformedUrl:
        'The %s value "%s" from the command line or sfdx-project.json is not in the correct format for a URL. It must be a valid URL in the ' +
        'format "http://salesforce.com". More information: https://nodejs.org/api/url.html#url_url_strings_and_url_objects'
    }
  },

  package_version_create_list: {
    en_US: {
      cliDescription: 'list package version creation requests',
      cliLongDescription: 'Lists all requests to create second-generation package versions in the Dev Hub org.',
      statusDescription: 'filter the list by version creation request status',
      statusLongDescription: 'Filters the list based on the status of version creation requests.',
      help:
        'Shows the details of each request to create a package version in the Dev Hub org.' +
        '\n\nAll filter parameters are applied using the AND logical operator (not OR).' +
        '\n\nTo get information about a specific request, run "sfdx force:package:version:create:report" and supply the request ID.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:version:create:list' +
        '\n   $ sfdx force:package:version:create:list --createdlastdays 3' +
        '\n   $ sfdx force:package:version:create:list --status Error' +
        '\n   $ sfdx force:package:version:create:list -s InProgress' +
        '\n   $ sfdx force:package:version:create:list -c 3 -s Success',
      id: 'ID',
      status: 'Status',
      packageId: 'Package Id',
      packageVersionId: 'Package Version Id',
      subscriberPackageVersionId: 'Subscriber Package Version Id',
      branch: 'Branch',
      tag: 'Tag',
      installUrl: 'Installation URL'
    }
  },

  package_version_create_report: {
    en_US: {
      cliDescription: 'retrieve details about a package version creation request',
      cliLongDescription: 'Retrieves details about a package version creation request in the Dev Hub org.',
      help:
        'Specify the request ID for which you want to view details. ' +
        'If applicable, the command displays errors related to the request.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:version:create:report -i 08c...' +
        '\n   $ sfdx force:package:version:create:report -i 08c... -v devhub@example.com' +
        '\n\nTo show all requests in the org, run "sfdx force:package:version:create:list".',
      requestId: 'package version creation request ID (starts with 08c)',
      requestIdLong: 'The ID (starts with 08c) of the package version creation request you want to display.',
      error: 'Error',
      truncatedErrors:
        '...\n\nTo see all errors, run: sfdx force:data:soql:query -t -q "SELECT Message FROM Package2VersionCreateRequestError WHERE ParentRequest.Id =\'%s\'"\n'
    }
  },

  package_version_update: {
    en_US: {
      cliDescription: 'update a package version',
      cliLongDescription: 'Updates a second-generation package version in the Dev Hub org.',
      help:
        'Specify a new value for each option you want to update.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:version:update -p "Your Package Alias" -k password123' +
        "\n   $ sfdx force:package:version:update -p 04t... -b master -t 'Release 1.0.7'" +
        '\n   $ sfdx force:package:version:update -p 04t... -e "New Package Version Description"' +
        '\n\nTo display details about a package version, run "sfdx force:package:version:report".',
      package: 'ID (starts with 04t) or alias of the package to update a version of',
      packageLong: 'The ID (starts with 04t) or alias of the package to update a version of.',
      name: 'new package version name',
      nameLong: 'The new package version name.',
      description: 'new package version description',
      descriptionLong: 'The new package version description.',
      branch: 'new package version branch',
      branchLong: 'The new package version branch.',
      tag: 'new package version tag',
      tagLong: 'The new package version tag.',
      key: 'new installation key for key-protected package (default: null)',
      longKey: 'The new installation key for the key-protected package. The default is null.',
      humanSuccess: 'Successfully updated the package version.',
      previousReleased:
        'To release the new package version, run "sfdx force:package:version:update -s <new package version ID>".'
    }
  },

  package_version_report: {
    en_US: {
      cliDescription: 'retrieve details about a package version in the Dev Hub org',
      cliLongDescription: 'Retrieves details about a package version in the Dev Hub org.',
      help:
        'Examples:' +
        '\n   $ sfdx force:package:version:report -p 04t...' +
        '\n   $ sfdx force:package:version:report -p "Your Package Alias"' +
        '\n\nTo update package version values, run "sfdx force:package:version:update".',
      package: 'ID (starts with 04t) or alias of the package to retrieve details for',
      packageLong: 'The ID (starts with 04t) or alias of the package to retrieve details for.',
      verboseDescription: 'displays extended package version details',
      verboseLongDescription: 'Displays extended package version details.'
    }
  },

  package_version_list: {
    en_US: {
      cliDescription: 'list all package versions in the Dev Hub org',
      cliLongDescription: 'Lists all package versions in the Dev Hub org.',
      conciseDescription: 'display limited package version details',
      conciseLongDescription: 'Displays limited package version details.',
      packagesDescription: 'filter results on specified comma-delimited packages (aliases or 0Ho IDs)',
      packagesLongDescription: 'Filters results on the specified comma-delimited packages (aliases or 0Ho IDs).',
      releasedDescription: 'display released versions only',
      releasedLongDescription: 'Displays released versions only (IsReleased=true).',
      orderByDescription: 'order by the specified package version fields',
      orderByLongDescription: 'Orders the list by the specified package version fields.',
      verboseDescription: 'display extended package version details',
      verboseLongDescription: 'Displays extended package version details.',
      help:
        'Displays details of each package version in the org.' +
        '\n\nUse --concise or --verbose to display limited or additional details, respectively.' +
        '\n\nAll filter parameters are applied using the AND logical operator (not OR).' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:version:list --verbose --createdlastdays 3 --released --orderby PatchVersion' +
        '\n   $ sfdx force:package:version:list --packages 0Ho000000000000,0Ho000000000001 --released --modifiedlastdays 0' +
        '\n   $ sfdx force:package:version:list --released' +
        '\n   $ sfdx force:package:version:list --concise --modifiedlastdays 0' +
        '\n   $ sfdx force:package:version:list --concise -c 3 -r' +
        '\n   $ sfdx force:package:version:list --packages exp-mgr,exp-mgr-util --released --modifiedlastdays 0',
      name: 'Name',
      description: 'Description',
      version: 'Version',
      id: 'Package Version Id',
      alias: 'Alias',
      subscriberPackageVersionId: 'Subscriber Package Version Id',
      convertedFromVersionId: 'Converted From Version Id',
      packageId: 'Package Id',
      packageBranch: 'Branch',
      packageTag: 'Tag',
      installUrl: 'Installation URL',
      installKey: 'Installation Key',
      codeCoverage: 'Code Coverage',
      hasPassedCodeCoverageCheck: 'Code Coverage Met',
      validationSkipped: 'Validation Skipped',
      releaseVersion: 'Release Version',
      buildDurationInSeconds: 'Build Duration in Seconds',
      hasMetadataRemoved: 'Managed Metadata Removed'
    }
  },

  package_installed_list: {
    en_US: {
      cliDescription: 'list the org’s installed packages',
      cliLongDescription: 'Lists all packages installed in the target org.',
      help:
        'Examples:' +
        '\n   $ sfdx force:package:installed:list' +
        '\n   $ sfdx force:package:installed:list -u me@example.com',
      username: 'a username or alias for the target org',
      id: 'ID',
      subscriberPackageId: 'Package ID',
      subscriberPackageName: 'Package Name',
      subscriberPackageNamespace: 'Namespace',
      subscriberPackageVersionId: 'Package Version ID',
      subscriberPackageVersionName: 'Version Name',
      subscriberPackageVersionNumber: 'Version'
    }
  },

  package_version_delete: {
    en_US: {
      cliDescription: 'delete a package version',
      cliLongDescription: 'Delete unlocked and second-generation managed package versions.',
      help:
        'Specify the ID or alias of the package version you want to delete.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:version:delete -p "Your Package Alias"' +
        '\n   $ sfdx force:package:version:delete -p 04t...',
      package: 'ID (starts with 04t) or alias of the package to update a version of',
      packageLong: 'The ID (starts with 04t) or alias of the package version to delete.',
      undelete: 'undelete a deleted package version',
      undeleteLong: 'Undelete a deleted package version.',
      noPrompt: 'don’t prompt before deleting the package version',
      noPromptLong: 'Don’t prompt before deleting the package version.',
      promptDelete: 'Deleted package versions can’t be recovered.' + '\n\nDo you want to continue? (y/n)',
      promptUndelete:
        'This will undelete the package version, which may result in unintended consequences for customers.  Proceed with caution.' +
        '\n\nDo you want to continue? (y/n)',
      promptDeleteDeny: 'The request to delete this package version has been canceled.',
      humanSuccess: 'Successfully deleted the package version.',
      humanSuccessUndelete: 'Successfully undeleted the package version.'
    }
  },

  package_delete: {
    en_US: {
      cliDescription: 'delete a package',
      cliLongDescription:
        'Delete unlocked and second-generation managed packages. Before you delete a package, first delete all associated package versions.',
      help:
        'Specify the ID or alias of the package you want to delete.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package:delete -p "Your Package Alias"' +
        '\n   $ sfdx force:package:delete -p 0Ho...',
      package: 'ID (starts with 0Ho) or alias of the package to delete',
      packageLong: 'The ID (starts with 0Ho) or alias of the package to delete.',
      undelete: 'undelete a deleted package',
      undeleteLong: 'Undelete a deleted package.',
      noPrompt: 'don’t prompt before deleting the package',
      noPromptLong: 'Don’t prompt before deleting the package.',
      promptDelete: 'Deleted packages can’t be recovered.' + '\n\nDo you want to continue? (y/n)',
      promptUndelete:
        'This will undelete the package, which may result in unintended consequences for customers.  Proceed with caution.' +
        '\n\nDo you want to continue? (y/n)',
      promptDeleteDeny: 'The request to delete this package was canceled',
      humanSuccess: 'Successfully deleted the package.',
      humanSuccessUndelete: 'Successfully undeleted the package.'
    }
  },

  // ******************************************* PACKAGE 2 LEGACY ********************************************
  package2: {
    en_US: {
      topicHelp: 'develop second-generation packages',
      topicHelpLong: 'Use the package2 commands to create, install, and manage second-generation packages.',
      createdLastDaysDescription:
        'created in the last specified number of days (starting at 00:00:00 of first day to now; 0 for today)',
      createdLastDaysLongDescription:
        'Filters the list based on the specified maximum number of days since the request was created ' +
        '(starting at 00:00:00 of first day to now; 0 for today).',
      modifiedLastDaysDescription:
        'list items modified in the specified last number of days (starting at 00:00:00 of first day to now; 0 for today)',
      modifiedLastDaysLongDescription:
        'Lists the items modified in the specified last number of days, starting at 00:00:00 of first day to now. Use 0 for today.',
      invalidId: 'Invalid %s: %s. Provide a valid ID that starts with %s.',
      invalidDaysNumber: 'Provide a valid positive number for %s.',
      invalidStatus: "Invalid status '%s'.  Please provide one of these statuses: %s",
      package2NotEnabledAction:
        'Second-generation packaging is not enabled on this org. Verify that you are authenticated to the desired org and try again. Otherwise, contact Salesforce Customer Support for more information.',
      package2InstanceNotEnabled:
        'Your org does not have permission to specify a build instance for your package version. Verify that you are authenticated to the desired org and try again. Otherwise, contact Salesforce Customer Support for more information.',
      package2SourceOrgNotEnabled:
        'Your Dev Hub does not have permission to specify a source org for your build org. Verify that you are authenticated to the correct Dev Hub and try again. Otherwise, contact Salesforce Customer Support for assistance.',
      installStatus: 'Waiting for the package install request to complete. Status = %s',
      errorMissingVersionNumber: 'The VersionNumber property must be specified.',
      errorInvalidVersionNumber:
        'VersionNumber must be in the format major.minor.patch.build but the value found is [%s].',
      errorInvalidBuildNumber:
        "The provided VersionNumber '%s' is invalid. Provide an integer value or use the keyword '%s' for the build number.",
      errorInvalidPatchNumber: "The provided VersionNumber '%s' is not supported. Provide a patch number of 0.",
      errorInvalidMajorMinorNumber:
        "The provided VersionNumber '%s' is invalid. Provide an integer value for the %s number.",
      errorInvalidAncestorVersionFormat:
        'The ancestor versionNumber must be in the format major.minor but the value found is [%s].',
      errorNoMatchingAncestor: "The ancestorId for ancestorVersion [%s] can't be found. Package 2 ID [%s].",
      errorAncestorIdVersionMismatch:
        'The ancestorVersion in sfdx-project.json is not the version expected for the ancestorId you supplied. ancestorVersion [%s]. ancestorID [%s].',
      errorpackage2AncestorIdsKeyNotSupported:
        'The package2AncestorIds key is no longer supported in a scratch org definition. Ancestors defined in sfdx-project.json will be included in the scratch org.'
    }
  },

  package2_create: {
    en_US: {
      cliDescription: 'create a second-generation package',
      cliLongDescription: 'Creates a second-generation package.',
      help:
        'First, use this command to create a second-generation package. Then create a package version.' +
        '\n\nYour --name value must be unique within your namespace.' +
        '\n\nExamples:' +
        "\n   $ sfdx force:package2:create -n PackageName -d 'My New Package' -o Unlocked" +
        "\n\nRun 'sfdx force:package2:list' to list all second-generation packages in the Dev Hub org.",
      name: 'package name',
      nameLong: 'Name of the second-generation package to create.',
      description: 'package description',
      descriptionLong: 'Description of the second-generation package.',
      noNamespace: 'creates the package with no namespace; available only for developer-controlled packages.',
      noNamespaceLong:
        'Creates the package with no namespace. Available only for developer-controlled packages. ' +
        'Useful when migrating an existing org to packages, but new metadata should use a namespaced package.',
      containerOptions:
        '[*Managed | Unlocked] container options for the package2 ' +
        '(Managed=DeveloperManagedSubscriberManaged, Unlocked=DeveloperControlledSubscriberEditable)',
      containerOptionsLong:
        'Container options for the package2. ' +
        '\nManaged is default. Other options include Unlocked. (Managed=DeveloperManagedSubscriberManaged, Unlocked=DeveloperControlledSubscriberEditable). ' +
        '\nThese options determine the upgrade and editability rules.',
      humanSuccess: 'Successfully created a second-generation package (package2).'
    }
  },

  package2_update: {
    en_US: {
      cliDescription: 'update a second-generation package',
      cliLongDescription: 'Updates a second-generation package.',
      help:
        'Specify a new value for each option you want to update.' +
        '\n\nExamples:' +
        "\n   $ sfdx force:package2:update --package2id 0Ho... --name 'AAnalytics'" +
        "\n   $ sfdx force:package2:update -i 0Ho... -d 'Advanced Analytics'" +
        "\n\nRun 'sfdx force:package2:list' to list all second-generation packages in the Dev Hub org.",
      id: 'id of the package (starts with 0Ho)',
      idLong: 'ID of package (starts with 0Ho).',
      name: 'package name',
      nameLong: 'Name of the package to update.',
      description: 'package description',
      descriptionLong: 'Description of the package.',
      humanSuccess: 'Successfully updated the package. ID: %s.'
    }
  },

  package2_list: {
    en_US: {
      cliDescription: 'list all second-generation packages in the Dev Hub org',
      cliLongDescription: 'Lists all second-generation packages in the Dev Hub org.',
      help: 'You can view the namespace, IDs, and other details for each package.',
      namespace: 'Namespace Prefix',
      name: 'Name',
      id: 'Id',
      package2Id: 'Subscriber Package2 Id',
      description: 'Description',
      containerOptions: 'Options'
    }
  },

  package2_version_create: {
    en_US: {
      cliDescription: 'create a second-generation package version',
      cliLongDescription: 'Creates a second-generation package (package2) version in the Dev Hub org.',
      help:
        'The package version is based on the package contents in the specified directory.' +
        '\n\nTo retrieve details about a package version create request, including status and package2 version ID (05i), ' +
        'run "sfdx force:package2:version:create:get -i 08c...".' +
        '\n\nTo list package version creation requests in the org, run "sfdx force:package2:version:create:list".' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package2:version:create -d common' +
        '\n   $ sfdx force:package2:version:create -i 0Ho... -d common',
      package2Id: 'ID of the parent package (starts with 0Ho)',
      longPackage2Id: 'ID of parent package (starts with 0Ho).',
      dir: 'path to directory that contains the contents of the package version',
      longDir: 'The path to the directory that contains the contents of the package version.',
      branch: 'the package version’s branch',
      longBranch: 'The package version’s branch.',
      tag: 'the package version’s tag',
      longTag: 'The package version’s tag.',
      key: 'installation key for key-protected package (default: null)',
      longKey: 'Installation key for creating the key-protected package. The default is null.',
      preserve: 'temp files are preserved that would otherwise be deleted',
      longPreserve: 'Specifies that the temp files are preserved that would otherwise be deleted',
      validateschema: 'sfdx-project.json is validated against JSON schema',
      longValidateschema: 'Specifies that the sfdx-project.json file should be validated against JSON schema',
      tempFileLocation: 'The temp files are located at: %s.',
      wait: 'minutes to wait for the package version to be created',
      longWait: 'The number of minutes to wait for the package version to be created.',
      instance: 'the instance where the package version will be created——for example, NA50',
      longInstance: 'The instance where the package version will be created——for example, NA50.',
      sourceorg: 'the source org ID used to copy the org shape for the build org',
      longSourceorg: 'The source org ID used to copy the org shape for the build org.',
      InProgress:
        'Package2 version creation request is InProgress. Run "sfdx force:package2:version:create:get -i %s" to query for status.',
      Queued:
        'Package2 version creation request is Queued. Run "sfdx force:package2:version:create:get -i %s" to query for status.',
      Success:
        'Successfully created the package2 version [%s]. Package2 Version Id: %s. Subscriber Package2 Version Id: %s.' +
        '\nPackage Installation URL: %s%s' +
        '\nAs an alternative, you can use the "sfdx force:package:install" command.',
      errorMissingFlags:
        'Include either a %s value or a %s value. The value must match one of the packageDirectories specified in sfdx-project.json.',
      errorNoMatchingPackageDirectory:
        'The %s value [%s], doesn’t match the %s value in any packageDirectories specified in sfdx-project.json.',
      errorDirectoryIdMismatch:
        'The %s value, [%s], and %s value, [%s], were both found in sfdx-project.json but don’t match. If you supply both values, they must match the path and id values in one of the packageDirectories.',
      errorDependencyPair:
        'Dependency must specify either a subscriberPackageVersionId or both packageId and versionNumber: %s.',
      errorNoIdInHub: 'No package2 ID was found in Dev Hub for package2 ID: %s.',
      errorEmptyPackageDirs:
        'sfdx-project.json must contain a packageDirectories entry for a package. It has no entries, currently.',
      unknownError: 'Package2 version creation failed with unknown error.',
      undefinedStatus: 'Package2 version creation returned with status: %s.'
    }
  },

  package2_version_create_list: {
    en_US: {
      cliDescription: 'list package version creation requests',
      cliLongDescription:
        'Lists all requests to create second-generation package (package2) versions in the Dev Hub org.',
      statusDescription: 'filter the list by version creation request status',
      statusLongDescription: 'Filters the list based on the status of version creation requests.',
      help:
        "Shows the details of each request to create a package2 version that's run in the Dev Hub org." +
        '\n\nAll filter parameters are applied using the AND logical operator (not OR).' +
        '\n\nTo get information about a specific request, run "sfdx force:package2:version:create:get" and supply the request ID.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package2:version:create:list' +
        '\n   $ sfdx force:package2:version:create:list --createdlastdays 3' +
        '\n   $ sfdx force:package2:version:create:list --status Error' +
        '\n   $ sfdx force:package2:version:create:list -s InProgress' +
        '\n   $ sfdx force:package2:version:create:list -c 3 -s Success',
      id: 'ID',
      status: 'Status',
      package2Id: 'Package2 Id',
      package2VersionId: 'Package2 Version Id',
      subscriberPackageVersionId: 'Subscriber Package2 Version Id',
      branch: 'Branch',
      tag: 'Tag',
      installUrl: 'Installation URL'
    }
  },

  package2_version_create_get: {
    en_US: {
      cliDescription: 'retrieve a package version creation request',
      cliLongDescription: 'Retrieves a second-generation package version creation request in the Dev Hub org.',
      help:
        'Specify the request ID for which you want to view details. ' +
        'If applicable, the command displays errors related to the request.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package2:version:create:get --package2createrequestid 08c...' +
        '\n\nTo show all requests in the org, run "sfdx force:package2:version:create:list".',
      requestId: 'package2 version creation request ID (starts with 08c)',
      requestIdLong: 'The ID of the package2 version creation request you want to display.',
      error: 'Error',
      truncatedErrors:
        '...\n\nTo see all errors, run: sfdx force:data:soql:query -t -q "SELECT Message FROM Package2VersionCreateRequestError WHERE ParentRequest.Id =\'%s\'"\n'
    }
  },

  package2_version_update: {
    en_US: {
      cliDescription: 'update a second-generation package version',
      cliLongDescription: 'Updates a second-generation package version in the Dev Hub org.',
      help:
        'Specify a new value for each option you want to update.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package2:version:update --package2versionid 05i... --setasreleased' +
        "\n   $ sfdx force:package2:version:update -i 05i... -b master -t 'Release 1.0.7'" +
        '\n\nTo display details about a package2 version, run "sfdx force:package2:version:get".',
      id: 'the package version ID (starts wtih 05i)',
      idLong: 'The package version ID (starts with 05i).',
      name: 'the package version name',
      nameLong: 'The package version name.',
      description: 'the package version description',
      descriptionLong: 'The second-generation package version description.',
      branch: 'the package version branch',
      branchLong: 'The second-generation package version branch.',
      tag: 'the package version tag',
      tagLong: 'The second-generation package version tag.',
      key: 'installation key for key-protected package (default: null)',
      longKey: 'Installation key for creating the key-protected package. The default is null.',
      setasreleased: 'set the package version as released (can’t be undone)',
      setasreleasedLong:
        'Sets the second-generation package version as released. Second-generation packages can’t be changed to ' +
        'beta after they’ve been released.',
      setasreleasedForce: 'no prompt to confirm setting the package version as released',
      setasreleasedForceLong: 'No prompt to confirm setting the package version as released.',
      humanSuccess: 'Successfully updated the package version. ID: %s.',
      previousReleased:
        'To release the new package2 version, run "sfdx force:package2:version:update -s <new package2 version ID>".'
    }
  },

  package2_version_get: {
    en_US: {
      cliDescription: 'retrieve a package version in the Dev Hub org',
      cliLongDescription: 'Retrieves a package version in the Dev Hub org.',
      help:
        'Examples:' +
        '\n   $ sfdx force:package2:version:get --package2versionid 05i...' +
        '\n\nTo update package version values, run "sfdx force:package2:version:update".'
    }
  },

  package2_version_list: {
    en_US: {
      cliDescription: 'list all package versions in the Dev Hub org',
      cliLongDescription: 'Lists all package2 versions in the Dev Hub org.',
      conciseDescription: 'display limited package2 version details',
      conciseLongDescription: 'Displays limited package2 version details.',
      package2IdsDescription: 'filter results on specified comma-delimited package2 ids (start with 0Ho)',
      package2IdsLongDescription: 'Filters results on the specified comma-delimited package2 IDs (start with 0Ho).',
      releasedDescription: 'display released versions only',
      releasedLongDescription: 'Displays released versions only (IsReleased=true).',
      orderByDescription: 'order by the specified package2 version fields',
      orderByLongDescription: 'Orders the list by the specified package2 version fields.',
      verboseDescription: 'display extended package2 versions detail',
      verboseLongDescription: 'Display extended package2 versions detail.',
      help:
        'Displays details of each package2 version in the org.' +
        '\n\nUse --concise or --verbose to display limited or additional details, respectively.' +
        '\n\nAll filter parameters are applied using the AND logical operator (not OR).' +
        '\n\nExamples:' +
        '\n   $ sfdx force:package2:version:list --verbose --createdlastdays 3 --released --orderby PatchVersion' +
        '\n   $ sfdx force:package2:version:list --package2ids 0Ho000000000000,0Ho000000000001 --released --modifiedlastdays 0' +
        '\n   $ sfdx force:package2:version:list --released' +
        '\n   $ sfdx force:package2:version:list --concise --modifiedlastdays 0' +
        '\n   $ sfdx force:package2:version:list --concise -c 3 -r',
      name: 'Name',
      description: 'Description',
      version: 'Version',
      id: 'Package2 Version Id',
      subscriberPackageVersionId: 'Subscriber Package2 Version Id',
      package2Id: 'Package2 Id',
      package2Branch: 'Branch',
      package2Tag: 'Tag',
      installUrl: 'Installation URL'
    }
  },

  // ************************************ END OF PACKAGE2 LEGACY *****************************************

  signup: {
    en_US: {
      quantifiedFeatureWithoutQuantityWarning:
        "The feature %s will be deprecated in a future release. It's been replaced by %s:<value>, which requires you to specify a quantity.",
      deprecatedFeatureWarning:
        'The feature %s has been deprecated. It has been removed from the list of requested features.',
      mappedFeatureWarning:
        'The feature %s has been deprecated. It has been replaced with %s in this scratch org create request.',
      INVALID_ID_FIELD: 'Provide a valid template ID, in the format 0TTxxxxxxxxxxxx.',
      'T-0002':
        'We couldn’t find a template or snapshot with the ID or name specified in the scratch org definition. If you’re sure the ID is correct, contact Salesforce Support.',
      'T-0003':
        'The template specified in the scratch org definition is unapproved. Contact Salesforce Support to request template approval.',
      'S-1006': 'Provide a valid email address in your scratch org definition or your %s file.',
      'S-2006': 'Provide a valid country code in your scratch org definition or your %s file.',
      'S-1017': 'Specify a namespace that’s used by a release org associated with your Dev Hub org.',
      'S-1018':
        'Provide a valid My Domain value. This value can’t include double hyphens, end in a hyphen, include restricted words, or be more than 40 characters long.',
      'S-1019': 'The My Domain value you chose is already in use.',
      'S-1026':
        'Provide a valid namespace value. This value must begin with a letter. It can’t include consecutive underscores, end in an underscore, be more than 15 characters long, or be a restricted or reserved namespace. Only alphanumeric characters and underscores are allowed.',
      'S-9999':
        'A fatal signup error occurred. Please try again. If you still see this error, contact Salesforce Support for assistance.',
      'SH-0001':
        'Can’t create scratch org. Contact the source org admin to add your Dev Hub org ID to Setup > Org Shape. Then try again.',
      'SH-0002':
        'Can’t create scratch org. No org shape exists for the specified sourceOrg. Create an org shape and try again.',
      'SH-0003':
        'Can’t create scratch org from org shape. The org shape version is outdated. Recreate the org shape and try again.',
      'C-1007':
        "The username provided to the org:create command is already in use. Run 'force:org:list --clean' to remove stale org authentications or create the org with a different username.",
      'C-1015':
        'We encountered a problem while registering your My Domain value with the DNS provider. Please try again.',
      'C-1016':
        'We encountered a problem while attempting to configure and approve the Connected App for your org. Verify the Connected App configuration with your Salesforce admin.',
      'C-1017':
        'Provide a valid namespace prefix. This value must begin with a letter. It can’t include consecutive underscores, end in an underscore, be more than 15 characters long, or be a restricted or reserved namespace. Only alphanumeric characters and underscores are allowed.',
      'C-1020':
        "We couldn't find a template with the ID specified in the scratch org definition. If you’re sure the ID is correct, contact Salesforce Support.",
      'C-1027':
        'The template specified in the Scratch Definition isn’t supported. Specify a generic edition (such as Developer or Enterprise), or specify a template ID.',
      'C-9999':
        'A fatal signup error occurred. Please try again. If you still see this error, contact Salesforce Support for assistance.',
      MyDomainResolverTimeoutError:
        'Successfully created org with ID: %s and name: %s. However, the My Domain URL %s has not finished propagating. Some commands may not work as expected until the My Domain DNS propagation is complete.',
      SourceStatusResetFailure:
        'Successfully created org with ID: %s and name: %s. Unfortunately, source tracking isn’t working as expected. If you run force:source:status, the results may be incorrect. Try again by creating another scratch org.'
    }
  },

  generatePassword: {
    en_US: {
      description: 'generate a password for scratch org users',
      longDescription:
        'Generates a password for scratch org users. Targets the usernames listed with the --onbehalfof parameter ' +
        'or the --targetusername parameter. Defaults to the defaultusername.',
      help:
        'Generates and sets a random password for one or more scratch org users.' +
        `${os.EOL}${os.EOL}If you haven’t set a default Dev Hub, or if your scratch org isn’t associated with your default Dev Hub, ` +
        '--targetdevhubusername is required.' +
        `${os.EOL}${os.EOL}To see a password that was previously generated, run "sfdx force:user:display".` +
        `${os.EOL}${os.EOL}Examples:` +
        `${os.EOL}   $ sfdx force:user:password:generate` +
        `${os.EOL}   $ sfdx force:user:password:generate -u me@my.org --json` +
        `${os.EOL}   $ sfdx force:user:password:generate -o "user1@my.org,user2@my.org,user3@my.org"`,
      onbehalfofParam: 'comma-separated list of usernames for which to generate passwords',
      onbehalfofParamLong: 'A comma-separated list of usernames for which to generate passwords.',
      noOrgProvided: 'Please specify the org for the user(s)',
      notFoundOnDevHub: 'The scratch org does not belong to the dev hub username %s.',
      userNotFound: 'The username "%s" was not found for scratch org %s',
      usersNotFound: 'The usernames "%s" were not found for scratch org %s',
      notADevHub: 'The provided dev hub username %s is not a valid dev hub.',
      action:
        'Specify the dev hub username that the scratch org belongs to with --targetdevhubusername or set a default run "sfdx force:config:set defaultdevhubusername=<username>".',
      success: 'Successfully set the password "%s" for user %s.',
      successMultiple: `Successfully set passwords:${os.EOL}`,
      viewWithCommand: 'You can see the password again by running "sfdx force:user:display -u %s".',
      noSelfSetAction:
        'Create a scratch org with the enableSetPasswordInApi org security setting set to TRUE and try again.'
    }
  },

  source: {
    en_US: {
      description: 'sync your project with your orgs',
      longDescription:
        'Use the source commands to push and pull source to and from your scratch orgs, ' +
        'to deploy and retrieve source to and from non-source-tracked orgs, ' +
        'to see synchronization changes between your project and scratch orgs, and to convert your source ' +
        'to the metadata format for Metadata API deployments.'
    }
  },

  source_convert: {
    en_US: {
      description: 'convert source into Metadata API format',
      longDescription: 'Converts source-formatted files into metadata that you can deploy using Metadata API.',
      help:
        'To convert source-formatted files into the metadata format, so that you can deploy them using Metadata API, ' +
        'run "sfdx force:source:convert". Then deploy the metadata using "sfdx force:mdapi:deploy".' +
        '\n\nTo convert Metadata API–formatted files into the source format, run "sfdx force:mdapi:convert".' +
        '\n\nTo specify a package name that includes spaces, enclose the name in single quotes.' +
        '\n\nExamples:' +
        '\n   $ sfdx force:source:convert -r path/to/source' +
        "\n   $ sfdx force:source:convert -r path/to/source -d path/to/outputdir -n 'My Package'",
      rootParam: 'a source directory other than the default package to convert',
      rootParamLongDescription:
        'A directory other than the default package directory that contains the source-formatted files to convert.',
      outputDirectoryParam: 'output directory to store the Metadata API–formatted files in',
      outputDirectoryParamLongDescription:
        'The output directory to store the Metadata API–formatted metadata files in.',
      packageNameParam: 'name of the package to associate with the metadata-formatted files',
      packageNameParamLongDescription: 'The name of the package to associate with the metadata-formatted files.',
      manifestLongDescription:
        'The complete path to the manifest (package.xml) file that specifies the metadata types to convert.' +
        '\nIf you specify this parameter, don’t specify --metadata or --sourcepath.',
      manifestDescription: 'file path to manifest (package.xml) of metadata types to convert.',
      sourcePathDescription: 'comma-separated list of paths to the local source files to convert',
      sourcePathLongDescription:
        'A comma-separated list of paths to the local source files to convert. ' +
        'The supplied paths can be to a single file (in which case the operation is applied to only one file) or to a folder ' +
        '(in which case the operation is applied to all metadata types in the directory and its sub-directories).' +
        '\nIf you specify this parameter, don’t specify --manifest or --metadata.',
      metadataParamDescription: 'comma-separated list of metadata component names to convert',
      metadataParamLongDescription: 'A comma-separated list of metadata component names to convert.'
    }
  },

  sourceConvertCommand: {
    en_US: {
      success: 'Source was successfully converted to Metadata API format and written to the location: %s',
      invalidRootDirectory: 'The package root directory does not exist: %s',
      noSourceInRootDirectory: 'No matching source was found within the package root directory: %s',
      rootDirectoryNotASourceDirectory: 'The package root directory is not a source directory'
    }
  },

  lightning: {
    en_US: {
      mainTopicDescriptionHelp: 'create Aura components and Lightning web components, and test Aura components',
      mainTopicLongDescriptionHelp:
        'Use the lightning commands to create Aura components and Lightning web components ' +
        'and to test Aura components. As of API version 45.0, you can build Lightning components using two programming models: ' +
        'Lightning Web Components, and the original model, Aura Components. Lightning web components and Aura components can ' +
        'coexist and interoperate on a page.'
    }
  },

  schema: {
    en_US: {
      mainTopicDescriptionHelp: 'view standard and custom objects',
      mainTopicLongDescriptionHelp:
        'Use the schema commands to view information about the ' + 'standard and custom objects in your org.'
    }
  },

  visualforce: {
    en_US: {
      mainTopicDescriptionHelp: 'create and edit Visualforce files',
      mainTopicLongDescriptionHelp: 'Use the visualforce commands to create Visualforce pages and components.'
    }
  },

  project: {
    en_US: {
      mainTopicDescriptionHelp: 'set up a Salesforce DX project',
      mainTopicLongDescriptionHelp: 'Use the project commands to set up a Salesforce DX project.'
    }
  },

  projectUpgrade: {
    en_US: {
      commandDescription: 'update project config files to the latest format',
      commandDescriptionLong: 'Updates project configuration and definition files to the latest format.',
      commandHelp: 'Examples:' + '\n $   sfdx force:project:upgrade' + '\n $   sfdx force:project:upgrade -f',
      forceOption: 'run all upgrades even if project has already been upgraded',
      forceOptionLong: 'Run all upgrades, even if the project definition files have already been upgraded.',

      error_validProject: 'Need a valid project to upgrade',
      error_upgradeFailed: 'Failed to upgrade: %s',

      prompt_renameProjectFile:
        'Found old project file in %s. To continue upgrade, you must rename it to %s. Would you like to continue (yes/no)?',
      prompt_queuedActions: 'Found %s project update(s) to perform. Do you want to continue (list/yes/no)?',
      prompt_continue: 'Do you want to continue (yes/no)?',

      prompt_orgDefPattern:
        'Check for old org definition files in the "config" directory using the pattern "config/*def.json" by entering "D" or "DEFAULT". Otherwise, enter the pattern to find your org definition files, such as "orgs/my-org-*def.json". To skip conversion of org definition files, enter "SKIP".',

      skipping: 'Skipping %s upgrades.',
      uptodate: 'Your project is up to date.',

      action_orgDefConversion: 'Upgrade %s org definition files to new format.',
      action_headsDownProject: 'Upgrade %s to headsDownCamelCase',
      action_removeUseDecomposition: 'Remove useDecomposition from %s'
    }
  },

  org_shape: {
    en_US: {
      create_shape_command_description: 'Create a scratch org configuration (shape) based on the specified source org',
      create_shape_command_description_long:
        'Create a scratch org configuration (shape) based on the specified source org.',
      create_shape_command_help:
        'Examples:' +
        '\n   $ sfdx force:org:shape:create -u me@my.org' +
        '\n   $ sfdx force:org:shape:create -u me@my.org --json --loglevel debug',
      create_shape_command_username: 'a username or alias for the target org',
      create_shape_command_username_long:
        'Username or alias of the previously authorized org from which you want to create an org shape.',
      create_shape_command_no_access: 'The org needs to be enabled for org shape before one can be created.'
    }
  },

  orgSnapshot: {
    en_US: {
      createSnapshotCmdDescription: 'snapshot a scratch org',
      createSnapshotCmdDescriptionLong: 'Creates a snapshot of a scratch org.',
      createSnapshotCmdHelp:
        'A snapshot is a point-in-time export of a scratch org. The export is stored in Salesforce ' +
        'and referenced by its unique name in a scratch definition file.' +
        '\n\nUse "sfdx force:org:snapshot:get" to get details, including status, about a snapshot creation request.' +
        '\n\nWith "snapshot" in your scratch org definition file, use "sfdx force:org:create" to create a scratch org from a snapshot.' +
        '\n\nExamples:' +
        '\n\n   $ sfdx force:org:snapshot:create --sourceorg 00Dxx0000000000 --snapshotname Dependencies --description "Contains PackageA v1.1.0"' +
        '\n\n   $ sfdx force:org:snapshot:create -o myuser@myorg -n NightlyBranch -d "Contains PkgA v2.1.0 and PkgB 3.3.0"',
      createSnapshotCmdSourceOrgDescription: 'ID or locally authenticated username or alias of scratch org to snapshot',
      createSnapshotCmdSourceOrgDescriptionLong:
        'The org ID, or a locally authenticated username or alias, of the scratch org to snapshot.',
      createSnapshotCmdNameDescription: 'unique name of snapshot',
      createSnapshotCmdNameDescriptionLong:
        'The unique name of the snapshot. Use this name to create scratch orgs from the snapshot.',
      createSnapshotCmdDescriptionDescription: 'description of snapshot',
      createSnapshotCmdDescriptionDescriptionLong:
        'A description of the snapshot. Use this description to document the contents ' +
        'of the snapshot. We suggest that you include a reference point, such as a version control system tag or commit ID.',

      getSnapshotCmdDescription: 'get details about a scratch org snapshot',
      getSnapshotCmdDescriptionLong: 'Retrieves details about a scratch org snapshot.',
      getSnapshotCmdHelp:
        'Use "sfdx force:org:snapshot:create" to create a snapshot.' +
        '\n\nUse "sfdx force:org:snapshot:list" to retrieve all snapshots.' +
        '\n\nExamples:' +
        '\n\n   $ sfdx force:org:snapshot:get --snapshot 0Oo...' +
        '\n\n   $ sfdx force:org:snapshot:get -s Dependencies',
      getSnapshotCmdSnapshotDescription: 'name or ID of snapshot to retrieve',
      getSnapshotCmdSnapshotDescriptionLong: 'The name or ID (starts with 0Oo) of the snapshot to retrieve.',

      listSnapshotCmdDescription: 'list scratch org snapshots',
      listSnapshotCmdDescriptionLong: 'Lists scratch org snapshots for your Dev Hub.',
      listSnapshotCmdHelp:
        'Use "sfdx force:org:snapshot:get" to get details about a snapshot request.' +
        '\n\nUse "sfdx force:org:snapshot:create" to create a snapshot.' +
        '\n\nExamples:' +
        '\n\n   $ sfdx force:org:snapshot:list' +
        '\n\n   $ sfdx force:org:snapshot:list -v OtherDevHub@example.com',

      deleteSnapshotCmdDescription: 'delete a scratch org snapshot',
      deleteSnapshotCmdDescriptionLong: 'Deletes a scratch org snapshot.',
      deleteSnapshotCmdHelp:
        'Examples:' +
        '\n\n   $ sfdx force:org:snapshot:delete --snapshot 0Oo...' +
        '\n\n   $ sfdx force:org:snapshot:delete -s BaseSnapshot',
      deleteSnapshotCmdSnapshotDescription: 'name or ID of snapshot to delete',
      deleteSnapshotCmdSnapshotDescriptionLong: 'The name or ID (starts with 0Oo) of the snapshot to delete.',

      snapshotNotEnabled: 'Org snapshots aren’t enabled for your Dev Hub.',
      sourceOrgInvalid: 'Provide a valid name or ID for your source org.',
      nameInvalid: 'Provide a valid name for your snapshot.',
      snapshotInvalid: 'Provide a valid name or ID for your snapshot.',
      unsupportedSnapshotOrgCreateOptions: 'Org snapshots don’t support one or more options you specified: %s'
    }
  }
};

const _getLocale = function() {
  return 'en_US';
};

export = function(locale = _getLocale()) {
  return {
    getMessage(label, args?: any, bundle = 'default') {
      const bundleLocale = messages[bundle][locale];

      if (util.isNullOrUndefined(bundleLocale)) {
        return null;
      }

      if (util.isNullOrUndefined(bundleLocale[label])) {
        throw new Error(util.format(bundleLocale.UndefinedLocalizationLabel, bundle, label, locale));
      }

      if (util.isNullOrUndefined(args)) {
        return bundleLocale[label];
      } else {
        if (!isArray(args)) args = [args];
        const everyone = [].concat(bundleLocale[label], args);
        // @ts-ignore TODO: typings want a min of one arg but the line above guarantees that
        return util.format(...everyone);
      }
    },

    getLocale() {
      return _getLocale();
    },

    get targetusername() {
      return TARGET_USERNAME_PARAM;
    },

    get perflog() {
      return PERF_LOG_LEVEL_PARAM;
    }
  };
};

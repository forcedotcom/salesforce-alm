/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Error from './force-cli-error';
import util = require('util');

// could expand with get and set locale functions
let locale = 'en_US';

export let get = function(label: string, ...args: any[]): string {
  if (!messages[locale]) {
    Error.exitWithMessage('Locale "' + locale + '" doesn’t exist');
  }
  if (!messages[locale][label]) {
    Error.exitWithMessage('Message "' + label + '" doesn’t exist');
  }
  if (args) {
    let expectedNumArgs = messages[locale][label].split('%s').length - 1;
    if (args.length !== expectedNumArgs) {
      Error.exitWithMessage(
        'Wrong number of args for message: ' + label + '\nExpect ' + expectedNumArgs + ' got ' + args.length
      );
    }

    args.unshift(messages[locale][label]);
    return util.format.apply(util, args);
  }
  return messages[locale][label];
};

const WAIT_DESC = 'the number of minutes to wait for the command to complete before displaying the results';
const WAIT_LONG_DESC = 'The number of minutes to wait for the command to complete before displaying the results.';
const PERFLOGLEVEL_JSON_HELP = '\n\nTo get data on API performance metrics, specify both --perflog and --json.';
const DATA_RECORD_HELP =
  'The format of a field-value pair is <fieldName>=<value>.' +
  '\nEnclose all field-value pairs in one set of double quotation marks, delimited by spaces.' +
  '\nEnclose values that contain spaces in single quotes.' +
  PERFLOGLEVEL_JSON_HELP;
const DATA_BULK_HELP =
  'One job can contain many batches, depending on the length of the CSV file.' +
  '\nReturns a job ID and a batch ID. Use these IDs to check job status with data:bulk:status.';

type Messages = {
  readonly [index: string]: {
    readonly [index: string]: string;
  };
};

let messages: Messages = {
  en_US: {
    ApexExecDescription: 'execute anonymous Apex code',
    ApexExecLongDescription: 'Executes one or more lines of anonymous Apex code, or executes the code in a local file.',
    ApexExecHelp:
      'Executes one or more lines of Apex code, or executes the code in a local file.' +
      '\nBefore you enter code, run this command with no parameters to get a prompt.' +
      '\nFrom the prompt, all commands are executed in a single execute anonymous request.' +
      '\nFor more information, see "Anonymous Blocks" in the Apex Developer Guide.' +
      '\n\nExamples:\n   $ sfdx force:apex:execute -f ~/test.apex' +
      '\n\n   $ sfdx force:apex:execute ' +
      '\n   >> Start typing Apex code. Press the Enter key after each line, ' +
      '\n   >> then press CTRL+D when finished.',
    ApexExecFilePathDescription: 'path to a local file containing Apex code',
    ApexExecFilePathLongDescription: 'Path to a local file that contains Apex code.',
    ApexExecTypingPrompt:
      '>> Start typing Apex code. Press the Enter key after each line, ' + '\n>> then press CTRL+D when finished.',
    ApexExecCompileSuccess: 'Compiled successfully.',
    ApexExecCompileFailed: 'Compilation failed.',
    ApexExecCompileFailedErrorMessage: 'Line: %s, Column: %s\n%s', // {line num}, {column num}, {error message}
    ApexExecExecutionSuccess: 'Executed successfully.\n',
    ApexExecExecutionFailure: 'Execution failed.\n',

    // the apex:limits command is hidden
    ApexLimitsDescription: 'display current org’s Apex governor limits',
    ApexLimitsLongDescription:
      'Displays the maximum Apex governor limits for your org. ' +
      'When you execute this command in a project, it reports limits for the default scratch org.',
    ApexLimitsHelp: 'Display the maximum execution governor limits for your org.',

    ApiLimitsDescription: 'display current org’s limits',
    ApiLimitsLongDescription: 'Displays remaining and maximum calls and events for your org.',
    ApiLimitsHelp:
      'When you execute this command in a project, it provides limit information for your default scratch org.' +
      '\n\nExamples:\n   $ sfdx force:limits:api:display' +
      '\n   $ sfdx force:limits:api:display -u me@my.org',

    ApexLogGetDescription: 'fetch the last debug log',
    ApexLogGetLongDescription: 'Fetches the last debug log.',
    ApexLogGetHelp:
      'When you execute this command in a project, it fetches the specified log or given number of last logs from your default scratch org.' +
      '\n\nTo get the IDs for your debug logs, run "sfdx force:apex:log:list".' +
      '\n\nTo specify a count of logs to return, use the --number parameter to return the most recent logs.' +
      '\n\nExecuting this command without parameters returns the most recent log.' +
      '\n\nExamples:\n   $ sfdx force:apex:log:get -i <log id>' +
      '\n   $ sfdx force:apex:log:get -i <log id> -u me@my.org' +
      '\n   $ sfdx force:apex:log:get -n 2 -c',
    ApexLogGetIdDescription: 'ID of the log to display',
    ApexLogGetIdLongDescription: 'ID of the log to display.',
    ApexLogGetLastNumberDescription: 'number of most recent logs to display',
    ApexLogGetLastNumberLongDescription: 'Number of most recent logs to display.',

    ApexLogListDescription: 'list debug logs',
    ApexLogListLongDescription: 'Displays a list of debug log IDs, along with general information about the logs.',
    ApexLogListHelp:
      'When you execute this command in a project, it lists the log IDs for your default scratch org.' +
      '\n\nExamples:\n   $ sfdx force:apex:log:list' +
      '\n   $ sfdx force:apex:log:list -u me@my.org',

    ApexLogTailDescription: 'start debug logging and display logs',
    ApexLogTailLongDescription:
      'Activates debug logging and displays logs in the terminal. You can also pipe the logs to a file.',
    ApexLogTailDebugLevelDescription: 'debug level for trace flag',
    ApexLogTailDebugLevelLongDescription: 'Debug level to set on the DEVELOPER_LOG trace flag for your user.',
    ApexLogTailSkipTraceFlagDescription: 'skip trace flag setup',
    ApexLogTailSkipTraceFlagLongDescription:
      'Skips trace flag setup. Assumes that a trace flag and debug level are fully set up.',
    ApexLogTailColorizeDescription: 'colorize noteworthy log lines',
    ApexLogTailColorizeLongDescription: 'Applies default colors to noteworthy log lines.',
    ApexLogTailHelp:
      'Tails logs from your target org for 30 minutes.' +
      '\n\nIf a DEVELOPER_LOG trace flag does not exist, this command creates one in the target org.' +
      "\n\nIf the active trace flag's expiration date is within this command's timeout window, the command sets the trace flag's expiration date to 30 minutes from the current time." +
      '\n\nThe --debuglevel parameter assigns a debug level to the active DEVELOPER_LOG trace flag.' +
      '\n\nUse --skiptraceflag to skip trace flag setup, including setting expiration date and debug level. Include this flag only if there is an active user-based trace flag for your user.' +
      '\n\nThe --json parameter emits log lines in JSON, but does not follow the standard Salesforce CLI JSON format (which includes status and result values).' +
      '\n\nExamples:\n   $ sfdx force:apex:log:tail' +
      '\n   $ sfdx force:apex:log:tail --debuglevel MyDebugLevel' +
      '\n   $ sfdx force:apex:log:tail -c -s',

    ConfigNoLoginFound: 'No active login found. Please log in again.',

    DataBulkDeleteDescription: 'bulk delete records from a csv file',
    DataBulkDeleteLongDescription: 'Deletes a batch of records listed in a CSV file.',
    DataBulkDeleteHelp:
      'The file must be a CSV file with only one column: "Id".' +
      '\n' +
      DATA_BULK_HELP +
      '\n\nExamples:\n   $ sfdx force:data:bulk:delete -s Account -f ./path/to/file.csv' +
      '\n   $ sfdx force:data:bulk:delete -s MyObject__c -f ./path/to/file.csv',
    DataBulkDeleteSobjectTypeDescription: 'the sObject type of the records you’re deleting',
    DataBulkDeleteSobjectTypeLongDescription: 'The sObject type of the records you’re deleting.',
    DataBulkDeleteCsvFilePathDescription: 'the path to the CSV file containing the ids of the records to delete',
    DataBulkDeleteCsvFilePathLongDescription:
      'The path to the CSV file that contains the IDs of the records to delete.',
    DataBulkDeleteWaitDescription: WAIT_DESC,
    DataBulkDeleteWaitLongDescription: WAIT_LONG_DESC,

    DataBulkStatusDescription: 'view the status of a bulk data load job or batch',
    DataBulkStatusLongDescription: 'Polls the Bulk API for job status or batch status.',
    DataBulkStatusHelp:
      'Examples:\n   $ sfdx force:data:bulk:status -i 750xx000000005sAAA' +
      '\n   $ sfdx force:data:bulk:status -i 750xx000000005sAAA -b 751xx000000005nAAA',
    DataBulkStatusJobIdDescription: 'the ID of the job you want to view or of the job whose batch you want to view',
    DataBulkStatusJobIdLongDescription:
      'The ID of the job you want to view or of the job whose batch you want to view.',
    DataBulkStatusBatchIdDescription: 'the ID of the batch whose status you want to view',
    DataBulkStatusBatchIdLongDescription: 'The ID of the batch whose status you want to view.',
    DataBulkStatusNoBatchFound: 'Unable to find batch %s for job %s.', // {batch id}, {job id}
    DataBulkStatusJobError: 'Unable to retrieve status of job %s.', // {job id}

    DataBulkUpsertDescription: 'bulk upsert records from a CSV file',
    DataBulkUpsertLongDescription:
      'Creates a job and one or more batches for inserting new rows and updating ' +
      'existing rows by accessing the Bulk API.',
    DataBulkUpsertHelp:
      'Inserts or updates records from a CSV file. ' +
      '\n' +
      DATA_BULK_HELP +
      '\n\nFor information about formatting your CSV file, see "Prepare CSV Files" in the Bulk API Developer Guide.' +
      '\n\nExamples:\n   $ sfdx force:data:bulk:upsert -s MyObject__c -f ./path/to/file.csv -i MyField__c' +
      '\n   $ sfdx force:data:bulk:upsert -s MyObject__c -f ./path/to/file.csv -i Id -w 2',
    DataBulkUpsertSobjectTypeDescription: 'the sObject type of the records you want to upsert',
    DataBulkUpsertSobjectTypeLongDescription: 'The sObject type of the records you want to upsert.',
    DataBulkUpsertCsvFilePathDescription: 'the path to the CSV file that defines the records to upsert',
    DataBulkUpsertCsvFilePathLongDescription: 'The path to the CSV file that defines the records to upsert.',
    DataBulkUpsertExternalIdDescription: 'the column name of the external ID',
    DataBulkUpsertExternalIdLongDescription: 'The column name of the external ID.',
    DataBulkUpsertWaitDescription: WAIT_DESC,
    DataBulkUpsertWaitLongDescription: WAIT_LONG_DESC,
    DataBulkUpsertCsvWrongNumberFields: 'Row #%s has %s columns. Expected %s columns.',
    // {record num}, {column nums}, {expected col. nums}
    DataBulkUpsertExternalIdRequired: 'An External ID is required on %s to perform an upsert.', // {sobject name}
    DataBulkUpsertCheckStatusCommand:
      'Check batch #%s’s status with the command:' + '\nsfdx force:data:bulk:status -i %s -b %s', // {batch num}, {job id}, {batch id}
    DataBulkUpsertPollingInfo:
      'Will poll the batch statuses every %s seconds' +
      '\nTo fetch the status on your own, press CTRL+C and use the command:' +
      '\nsfdx force:data:bulk:status -i %s -b [<batchId>]', // {polling frequency}, {job id}
    DataBulkUpsertBatchQueued: 'Batch #%s queued (Batch ID: %s).', // {batch num}, {batch id}
    DataBulkTimeOut:
      'The operation timed out. Check the status with command:' + '\nsfdx force:data:bulk:status -i %s -b %s',

    DataRecordWhereDescription: 'a list of <fieldName>=<value> pairs to search for',
    DataRecordWhereLongDescription: 'A list of <fieldName>=<value> pairs to search for.',
    DataRecordNeitherSobjectidNorWhereError: 'Provide either -i or -w.',
    DataRecordBothSobjectidAndWhereError: 'Provide either -i or -w, but not both.',

    DataRecordCreateDescription: 'create a record',
    DataRecordCreateLongDescription: 'Creates and inserts a record.',
    DataRecordCreateHelp:
      DATA_RECORD_HELP +
      '\n\nExamples:\n   $ sfdx force:data:record:create -s Account -v "Name=Acme"' +
      '\n   $ sfdx force:data:record:create -s Account -v "Name=\'Universal Containers\'"' +
      '\n   $ sfdx force:data:record:create -s Account -v "Name=\'Universal Containers\' Website=www.example.com"' +
      '\n   $ sfdx force:data:record:create -t -s TraceFlag -v "DebugLevelId=7dl170000008U36AAE ' +
      'StartDate=2017-12-01T00:26:04.000+0000 ExpirationDate=2017-12-01T00:56:04.000+0000 ' +
      'LogType=CLASS_TRACING TracedEntityId=01p17000000R6bLAAS"' +
      '\n   $ sfdx force:data:record:create -s Account -v "Name=Acme" --perflog --json',
    DataRecordCreateValuesDescription: 'the <fieldName>=<value> pairs you’re creating',
    DataRecordCreateValuesLongDescription: 'The <fieldName>=<value> pairs you’re creating.',
    DataRecordCreateSobjectDescription: 'the type of the record you’re creating',
    DataRecordCreateSobjectLongDescription: 'The sObject type of the record you’re creating.',
    DataRecordCreateToolingDescription: 'create the record with tooling api',
    DataRecordCreateToolingLongDescription: 'Create the record using Tooling API.',
    DataRecordCreateSuccess: 'Successfully created record: %s.', // {record id}
    DataRecordCreateFailure: 'Failed to create record. %s', // {list of error messages}

    DataRecordDeleteDescription: 'delete a record',
    DataRecordDeleteLongDescription: 'Deletes a single record.',
    DataRecordDeleteHelp:
      'Specify an sObject type and either an ID or a list of <fieldName>=<value> pairs.' +
      '\n' +
      DATA_RECORD_HELP +
      '\n\nExamples:' +
      '\n   $ sfdx force:data:record:delete -s Account -i 001D000000Kv3dl' +
      '\n   $ sfdx force:data:record:delete -s Account -w "Name=Acme"' +
      '\n   $ sfdx force:data:record:delete -s Account -w "Name=\'Universal Containers\'"' +
      "\n   $ sfdx force:data:record:delete -s Account -w \"Name='Universal Containers' Phone='(123) 456-7890'\"" +
      '\n   $ sfdx force:data:record:delete -t -s TraceFlag -i 7tf170000009cU6AAI --perflog --json',
    DataRecordDeleteSobjectDescription: 'the type of the record you’re deleting',
    DataRecordDeleteSobjectLongDescription: 'The sObject type of the record you’re deleting.',
    DataRecordDeleteToolingDescription: 'delete the record with Tooling API',
    DataRecordDeleteToolingLongDescription: 'Delete the record using Tooling API.',
    DataRecordDeleteIdDescription: 'the ID of the record you’re deleting',
    DataRecordDeleteIdLongDescription: 'The ID of the record you’re deleting.',
    DataRecordDeleteSuccess: 'Successfully deleted record: %s.', // {record id}
    DataRecordDeleteFailure: 'Failed to delete record. %s', // {list of error messages}

    DataRecordGetDescription: 'view a record',
    DataRecordGetLongDescription: 'Displays a single record.',
    DataRecordGetHelp:
      'Specify an sObject type and either an ID or a list of <fieldName>=<value> pairs.' +
      '\n' +
      DATA_RECORD_HELP +
      '\n\nExamples:' +
      '\n   $ sfdx force:data:record:get -s Account -i 001D000000Kv3dl' +
      '\n   $ sfdx force:data:record:get -s Account -w "Name=Acme"' +
      '\n   $ sfdx force:data:record:get -s Account -w "Name=\'Universal Containers\'"' +
      "\n   $ sfdx force:data:record:get -s Account -w \"Name='Universal Containers' Phone='(123) 456-7890'\"" +
      '\n   $ sfdx force:data:record:get -t -s TraceFlag -i 7tf170000009cUBAAY --perflog --json',
    DataRecordGetSobjectDescription: 'the type of the record you’re retrieving',
    DataRecordGetSobjectLongDescription: 'The sObject type of the record you’re retrieving.',
    DataRecordGetToolingDescription: 'retrieve the record with Tooling API',
    DataRecordGetToolingLongDescription: 'Retrieve the record using Tooling API.',
    DataRecordGetIdDescription: 'the ID of the record you’re retrieving',
    DataRecordGetIdLongDescription: 'The ID of the record you’re retrieving.',
    DataRecordGetNoRecord: 'No matching record found.',
    DataRecordGetMultipleRecords:
      '%s is not a unique qualifier for %s; %s records were retrieved.' +
      // {field value}, {field name}, {number of records with given value}
      '\nRetrieve only one record.',
    DataRecordGetIdFormatError: 'Could not parse field value %s. Expected format <fieldName>=<value>.', // {field name}

    DataRecordUpdateDescription: 'update a record',
    DataRecordUpdateLongDescription: 'Updates a single record.',
    DataRecordUpdateHelp:
      DATA_RECORD_HELP +
      '\n\nExamples:' +
      '\n   $ sfdx force:data:record:update -s Account -i 001D000000Kv3dl -v "Name=NewAcme"' +
      '\n   $ sfdx force:data:record:update -s Account -w "Name=\'Old Acme\'" -v "Name=\'New Acme\'"' +
      '\n   $ sfdx force:data:record:update -s Account -i 001D000000Kv3dl -v "Name=\'Acme III\' Website=www.example.com"' +
      '\n   $ sfdx force:data:record:update -t -s TraceFlag -i 7tf170000009cUBAAY -v "ExpirationDate=2017-12-01T00:58:04.000+0000"' +
      '\n   $ sfdx force:data:record:update -s Account -i 001D000000Kv3dl -v "Name=NewAcme" --perflog --json',
    DataRecordUpdateSobjectDescription: 'the type of the record you’re updating',
    DataRecordUpdateSobjectLongDescription: 'The sObject type of the record you’re updating.',
    DataRecordUpdateToolingDescription: 'update the record with Tooling API',
    DataRecordUpdateToolingLongDescription: 'Update the record using Tooling API.',
    DataRecordUpdateValuesDescription: 'the <fieldName>=<value> pairs you’re updating',
    DataRecordUpdateValuesLongDescription: 'The <fieldName>=<value> pairs you’re updating.',
    DataRecordUpdateIdDescription: 'the ID of the record you’re updating',
    DataRecordUpdateIdLongDescription: 'The ID of the record you’re updating.',
    DataRecordUpdateNoFields: 'Specify at least one field to update, in the format <fieldName>=<value>.',
    DataRecordUpdateSuccess: 'Successfully updated record: %s.', // {record id}
    DataRecordUpdateFailure: 'Failed to update record. %s', // {list of error messages}

    DataSOQLQueryDescription: 'execute a SOQL query',
    DataSOQLQueryLongDescription: 'Executes a SOQL query.',
    DataSOQLQueryHelp:
      'When you execute this command in a project, ' +
      'it executes the query against the data in your default scratch org.' +
      PERFLOGLEVEL_JSON_HELP +
      '\n\nExamples:\n   $ sfdx force:data:soql:query -q "SELECT Id, Name, Account.Name FROM Contact"' +
      "\n   $ sfdx force:data:soql:query -q \"SELECT Id, Name FROM Account WHERE ShippingState IN ('CA', 'NY')\"" +
      '\n   $ sfdx force:data:soql:query -q "SELECT Name FROM ApexTrigger" -t' +
      '\n   $ sfdx force:data:soql:query -q "SELECT Name FROM ApexTrigger" --perflog --json',
    DataSOQLQueryNoResults: 'Your query returned no results.',
    DataSOQLQueryQueryDescription: 'SOQL query to execute',
    DataSOQLQueryQueryLongDescription: 'SOQL query to execute.',
    DataSOQLQueryToolingDescription: 'execute query with Tooling API',
    DataSOQLQueryToolingLongDescription: 'Execute the query using Tooling API.',
    DataSOQLQueryMoreMissingUrl: 'Server response is missing the next URL; cannot query the rest of the results.',
    DataSOQLQueryMoreMissingRecords:
      'Server response is missing the next records; cannot display the rest of the results.',
    DataSOQLQueryInvalidReporter: 'Unknown result format type. Must be one of the following values: %s',

    DisplayWarning: 'WARNING: %s', // {message}
    DisplayHeaderApplication: 'Application',
    DisplayHeaderDuration: 'Duration (ms)',
    DisplayHeaderId: 'Id',
    DisplayHeaderLocation: 'Location',
    DisplayHeaderLogLength: 'Size (B)',
    DisplayHeaderLogUser: 'Log User',
    DisplayHeaderOperation: 'Operation',
    DisplayHeaderRequest: 'Request',
    DisplayHeaderStartTime: 'Start Time',
    DisplayHeaderStatus: 'Status',
    DisplayHeaderName: 'Name',
    DisplayHeaderRemaining: 'Remaining',
    DisplayHeaderMaximum: 'Maximum',
    DisplayQueryRecordsRetrieved: 'Total number of records retrieved: %s.', // {num of records}
    DisplayBulkBatch: 'Batch #%s', // {batch num}
    DisplayBulkError: 'Upsert errors',
    DisplayBulkJobStatus: 'Job Status',
    DisplayBulkBatchStatus: 'Batch Status',
    DisplayNoLogs: 'No debug logs to display.',

    ErrorError: 'ERROR: ',
    ErrorAbort: 'ABORTED',

    ResponseParserStatusError: 'Could not parse status information from server response: %s.', // {server response}
    ResponseParserDebugError: 'Could not parse debug information from server response: %s.', // {server response}

    SchemaDeleteDescription: 'delete a custom field or custom object',
    SchemaDeleteLongDescription: 'Deletes a custom field on a standard or custom object, or deletes a custom object.',
    SchemaDeleteHelp:
      'Examples:\n   $ sfdx force:schema:delete -n Account.myField__c' +
      '\n   $ sfdx force:schema:delete -n MyObject__c' +
      '\n   $ sfdx force:schema:delete -n MyObject__c.myField__c' +
      '\n   $ sfdx force:schema:delete -n namespace__MyObject__c.namespace__myField__c',
    SchemaDeleteNameDescription: 'the API name of the field or object to delete',
    SchemaDeleteNameLongDescription: 'The API name of the field or object to delete.',
    SchemaDeleteFailure: 'Deletion failed for %s %s.', // {CustomObject/CustomField}, {object/field name}
    SchemaDeleteSuccess: 'Successfully deleted %s %s.', // {CustomObject/CustomField}, {object/field name}
    SchemaDeleteCantDeleteStandard: 'You can’t delete standard objects. Did you forget the "__c" suffix?',
    SchemaDeleteInvalidObjectName: 'Unable to parse API name: %s', // {object name}
    SchemaDeleteExistingData:
      'Deleting this field/object will delete all associated data.' + '\nDo you wish to continue? (y/n)',

    SchemaSObjectDescribeDescription: 'describe an object',
    SchemaSObjectDescribeLongDescription: 'Displays the metadata for a standard or custom object.',
    SchemaSObjectDescribeHelp:
      'Examples:\n   $ sfdx force:schema:sobject:describe -s Account' +
      '\n   $ sfdx force:schema:sobject:describe -s MyObject__c' +
      '\n   $ sfdx force:schema:sobject:describe -s ApexClass -t',
    SchemaSObjectDescribeObjectNameDescription: 'the API name of the object to describe',
    SchemaSObjectDescribeObjectNameLongDescription: 'The API name of the object to describe.',
    SchemaSObjectDescribeToolingDescription: 'execute with Tooling API',
    SchemaSObjectDescribeToolingLongDescription: 'Execute using Tooling API.',

    SchemaSObjectListDescription: 'list all objects of a specified category',
    SchemaSObjectListLongDescription: 'Lists all objects of a specified sObject category.',
    SchemaSObjectListHelp:
      'Lists all objects, custom objects, or standard objects in the org.' +
      '\n\nExamples:\n   $ sfdx force:schema:sobject:list -c all' +
      '\n   $ sfdx force:schema:sobject:list -c custom' +
      '\n   $ sfdx force:schema:sobject:list -c standard',
    SchemaSObjectListTypeDescription: 'the type of objects to list (all|custom|standard)',
    SchemaSObjectListTypeLongDescription: 'The type of objects to list: all, custom, or standard.',
    SchemaSObjectListTypeInvalidValue: '"Type" flag can be set only to <all|custom|standard>.',
    SchemaSObjectListObjectOfTypeNotFound: 'No %s objects found.', // {object category}

    SourceOpenDescription: 'edit a Lightning Page with Lightning App Builder',
    SourceOpenLongDescription:
      'Opens the specified Lightning Page in Lightning App Builder. Lightning Page ' +
      'files have the suffix .flexipage-meta.xml, and are stored in the flexipages directory. If you specify a ' +
      'different type of file, this command opens your org’s home page.',
    SourceOpenHelp:
      'The file opens in your default browser.' +
      '\nIf no browser-based editor is available for the selected file, this command opens your org’s home page.' +
      '\nTo generate a URL for the browser-based editor but not open the editor, use --urlonly.' +
      '\n\nExamples:\n   $ sfdx force:source:open -f Property_Record_Page.flexipage-meta.xml' +
      '\n   $ sfdx force:source:open -f Property_Record_Page.flexipage-meta.xml -r',
    SourceOpenFileDescription: 'file to edit',
    SourceOpenFileLongDescription: 'File to edit.',
    SourceOpenPathDescription: 'generate a navigation URL; don’t launch the editor',
    SourceOpenPathLongDescription: 'Generate a navigation URL path, but don’t launch a browser-based editor.',
    SourceOpenCommandHumanSuccess: 'Access org %s as user %s with the following URL: %s',
    SourceOpenCommandHumanError: 'An error occurred while opening the Salesforce org: %s',
    SourceOpenCommandUnpushedError: 'no metadata in Salesforce org (consider running source:push)',

    UsernameOption: 'username or alias for the target org',
    JsonOutputOption: 'json output',

    TextUtilMalformedKeyValuePair: 'Malformed key=value pair for value: %s',

    WaitTimeError: 'Wait time must be greater than 0 minutes'
  }
};

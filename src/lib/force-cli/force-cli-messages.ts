/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import util = require('util');
import * as Error from './force-cli-error';

// could expand with get and set locale functions
const locale = 'en_US';

export const get = function (label: string, ...args: any[]): string {
  if (!messages[locale]) {
    Error.exitWithMessage('Locale "' + locale + '" doesn’t exist');
  }
  if (!messages[locale][label]) {
    Error.exitWithMessage('Message "' + label + '" doesn’t exist');
  }
  if (args) {
    const expectedNumArgs = messages[locale][label].split('%s').length - 1;
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

type Messages = {
  readonly [index: string]: {
    readonly [index: string]: string;
  };
};

const messages: Messages = {
  en_US: {
    // the apex:limits command is hidden
    ApexLimitsDescription: 'display current org’s Apex governor limits',
    ApexLimitsLongDescription:
      'Displays the maximum Apex governor limits for your org. ' +
      'When you execute this command in a project, it reports limits for the default scratch org.',
    ApexLimitsHelp: 'Display the maximum execution governor limits for your org.',

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
    DisplayQueryRecordsRetrieved: 'Total number of records retrieved: %s.', // {num of records}
    DisplayBulkBatch: 'Batch #%s', // {batch num}
    DisplayBulkError: 'Upsert errors',
    DisplayBulkJobStatus: 'Job Status',
    DisplayBulkBatchStatus: 'Batch Status',
    DisplayNoLogs: 'No debug logs to display.',

    ErrorError: 'ERROR: ',
    ErrorAbort: 'ABORTED',

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

    WaitTimeError: 'Wait time must be greater than 0 minutes',
  },
};

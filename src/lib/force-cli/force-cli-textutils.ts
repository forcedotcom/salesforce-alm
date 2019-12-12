/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholly superseded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import * as Messages from './force-cli-messages';

/**
 * Takes a sequence of key=value string pairs and produces an object out of them.
 * If you repeat the key, it replaces the value with the subsequent value.
 *
 * @param [keyValuePairs] - The list of key=value pair strings.
 */
export function transformKeyValueSequence(keyValuePairs: string[]): Object {
  const constructedObject = {};

  keyValuePairs.forEach(pair => {
    // Look for the *first* '=' and splits there, ignores any subsequent '=' for this pair
    const eqPosition = pair.indexOf('=');
    if (eqPosition === -1) {
      throw new Error(Messages.get('TextUtilMalformedKeyValuePair', pair));
    } else {
      const key = pair.substr(0, eqPosition);
      const value = pair.substr(eqPosition + 1);
      constructedObject[key] = value;
    }
  });

  return constructedObject;
}

/**
 * Splits a sequence of 'key=value key="leftValue rightValue"   key=value'
 * into a list of key=value pairs, paying attention to quoted whitespace.
 *
 * This is NOT a full push down-automaton so do NOT expect full error handling/recovery.
 *
 * @param {string} text - The sequence to split
 */
export function parseKeyValueSequence(text: string): string[] {
  const separator = /\s/;

  let inSingleQuote = false,
    inDoubleQuote = false;
  let currentToken: string[] = [];
  let keyValuePairs: string[] = [];

  let trimmedText = text.trim();
  for (let i = 0; i < trimmedText.length; i++) {
    const currentChar = trimmedText[i];
    const isSeparator = currentChar.match(separator);

    if (currentChar === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    } else if (currentChar === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && isSeparator) {
      if (currentToken.length > 0) {
        keyValuePairs.push(currentToken.join(''));
        currentToken = [];
      }
    } else {
      currentToken.push(currentChar);
    }
  }

  // For the case of only one key=value pair with no separator
  if (currentToken.length > 0) {
    keyValuePairs.push(currentToken.join(''));
  }

  return keyValuePairs;
}

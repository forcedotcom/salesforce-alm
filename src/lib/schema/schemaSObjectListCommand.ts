import * as Display from '../force-cli/force-cli-display';
import * as Config from '../force-cli/force-cli-config';
import * as Messages from '../force-cli/force-cli-messages';

export enum Type {
  ALL,
  STANDARD,
  CUSTOM
}

export class SchemaSObjectListCommand {
  validate(context) {}

  async execute(context): Promise<any> {
    context.flags.sobjecttypecategory = Type[context.flags.sobjecttypecategory.toUpperCase()];
    if (context.flags.sobjecttypecategory === undefined) {
      throw new Error(Messages.get('SchemaSObjectListTypeInvalidValue'));
    }
    return await describeObjectsOfType(context);
  }
}

export const describeObjectsOfType = async function(context: any): Promise<string[]> {
  const typeDescriptions: string[] = [];

  const conn = await Config.getActiveConnection(context);
  const allDescriptions = await conn.describeGlobal();
  let havePrinted = false;
  allDescriptions['sobjects'].forEach(function(sobject) {
    const isCustom = sobject.custom === true;
    const doPrint =
      context.flags.sobjecttypecategory === Type.ALL ||
      (context.flags.sobjecttypecategory === Type.CUSTOM && isCustom) ||
      (context.flags.sobjecttypecategory === Type.STANDARD && !isCustom);
    if (doPrint) {
      havePrinted = true;
      Display.info(sobject.name);
      typeDescriptions.push(sobject.name);
    }
  });
  if (!havePrinted) {
    Display.info(Messages.get('SchemaSObjectListObjectOfTypeNotFound', Type[context.flags.sobjecttypecategory]));
  }

  return typeDescriptions;
};

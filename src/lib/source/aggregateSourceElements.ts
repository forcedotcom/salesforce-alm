import { AggregateSourceElement } from './aggregateSourceElement';
import { WorkspaceElement } from './workspaceElement';

export type PackageName = string;
export type SourceElementKey = string;
export type AggregateSourceElementMap = Map<SourceElementKey, AggregateSourceElement>;
type AggregateSourceElementEntries = [PackageName, AggregateSourceElementMap][] | null;

export class AggregateSourceElements extends Map<PackageName, AggregateSourceElementMap> {
  constructor(entries?: AggregateSourceElementEntries) {
    super(entries);
  }

  /**
   * DO NOT USE. Use getSourceElement instead.
   * Returns the FIRST matching AggregateSourceElement. We should not use this method
   * because you're not guaranteed to get the source element from the correct package.
   */
  public findSourceElementByKey(key: SourceElementKey): AggregateSourceElement {
    let returnValue: AggregateSourceElement;
    this.forEach(aggregateSourceElements => {
      if (aggregateSourceElements.has(key)) {
        returnValue = aggregateSourceElements.get(key);
      }
    });
    return returnValue;
  }

  public getSourceElement(packageName: PackageName, key: SourceElementKey): AggregateSourceElement {
    if (this.has(packageName)) {
      return this.get(packageName).get(key);
    }
  }

  public deleteSourceElement(packageName: PackageName, key: SourceElementKey) {
    if (this.has(packageName)) {
      this.get(packageName).delete(key);
    }
    return this;
  }

  public setIn(packageName: PackageName, sourceElementKey: SourceElementKey, sourceElement: AggregateSourceElement) {
    if (this.has(packageName)) {
      this.get(packageName).set(sourceElementKey, sourceElement);
    } else {
      this.set(packageName, new Map().set(sourceElementKey, sourceElement));
    }
    return this;
  }

  /**
   * Returns a flat array of all source elements across all packages
   */
  public getAllSourceElements(): AggregateSourceElement[] {
    let elements = [];
    this.forEach(sourceElements => {
      elements = elements.concat([...sourceElements.values()]);
    });
    return elements;
  }

  public getAllWorkspaceElements(): WorkspaceElement[] {
    let elements = [];
    this.forEach(sourceElements => {
      [...sourceElements.values()].forEach(el => {
        elements = elements.concat(el.workspaceElements);
      });
    });
    return elements;
  }

  public getAllSourceKeys(): SourceElementKey[] {
    let keys = [];
    this.forEach(sourceElements => {
      keys = keys.concat([...sourceElements.keys()]);
    });
    return keys;
  }

  public isEmpty(): boolean {
    return this.size === 0;
  }

  public merge(aggregateSourceElements: AggregateSourceElements) {
    aggregateSourceElements.forEach((aseMap, packageName) => {
      if (this.has(packageName)) {
        const elements = this.get(packageName);
        this.set(packageName, new Map([...elements, ...aseMap]));
      } else {
        this.set(packageName, aseMap);
      }
    });
    return this;
  }
}

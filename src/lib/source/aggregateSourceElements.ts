import { AggregateSourceElement } from './aggregateSourceElement';
import { NonDecomposedElementsIndex } from './nonDecomposedElementsIndex';
import { WorkspaceElement } from './workspaceElement';

export type PackageName = string;
export type SourceElementKey = string;
export type AggregateSourceElementMap = Map<SourceElementKey, AggregateSourceElement>;
type AggregateSourceElementEntries = [PackageName, AggregateSourceElementMap][] | null;

// Configure filter options such as fuzzy matching on metadata types.
// E.g., "Document" fuzzy matches "Document" and "DocumentFolder"
type FilterOptions = {
  fuzzy?: boolean;
};

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

  /**
   * Returns `AggregateSourceElements` from all package directories matching the
   * given source element key.
   *
   * @param key a metadata type name pair.  E.g., ApexClass__MyClass
   * @param options the filter options to apply when matching AggregateSourceElements
   */
  public filterSourceElementsByKey(key: SourceElementKey, options: FilterOptions = {}): AggregateSourceElements {
    const filteredElements = new AggregateSourceElements();
    this.forEach(aseMap => {
      if (options.fuzzy) {
        const [fuzzyMdType, mdName = ''] = key.split('__');
        aseMap.forEach((ase, aseKey) => {
          let [type, name] = aseKey.split('__');
          name = mdName === '' ? '' : name;

          // This ASE matches if:
          //   1. The metadata type fuzzy matches *AND*
          //   2. The metadata type is "CustomLabel" and belongs to this ASE *OR*
          //   3. The metadata names are the same
          if (type.includes(fuzzyMdType)) {
            if (fuzzyMdType === 'CustomLabel' && name !== '') {
              // Special handling for an individual CustomLabel.
              // Must find it within the labels source file to match.
              const sourcePath = ase.getMetadataFilePath();
              if (NonDecomposedElementsIndex.belongsTo(sourcePath, `CustomLabels__${mdName}`)) {
                filteredElements.setIn(ase.getPackageName(), aseKey, ase);
              }
            } else if (name === mdName) {
              filteredElements.setIn(ase.getPackageName(), aseKey, ase);
            }
          }
        });
      } else {
        if (aseMap.has(key)) {
          const ase = aseMap.get(key);
          filteredElements.setIn(ase.getPackageName(), ase.getKey(), ase);
        }
      }
    });
    return filteredElements;
  }

  /**
   * Attempts to find the parent AggregateSourceElement across package directories
   * that contains the matching child metadata type and name as a WorkspaceElement.
   * It then returns the parent ASE with all WorkspaceElements removed except for
   * the matching child WorkspaceElement.  This allows fine-grained deploys/retrieves.
   *
   * E.g., Given the custom field "FieldA" that belongs to custom object "CO1";
   *         - CO1 has meta-xml file and "FieldB" in package directory X
   *         - CO1 also has "FieldA" and "FieldC" in package directory Y
   *       This method will return the "CO1" ASE from package dir Y containing
   *       only the "FieldA" WorkspaceElement.
   */
  public findParentElement(parentKey: SourceElementKey, childType: string, childName: string): AggregateSourceElement {
    let returnValue: AggregateSourceElement;
    // debug(`finding parent element: ${parentKey} containing child: ${childKey}`);
    this.forEach(aggregateSourceElements => {
      if (aggregateSourceElements.has(parentKey)) {
        const ase = aggregateSourceElements.get(parentKey);
        if (childType && childName) {
          let matchingWorkspaceElement: WorkspaceElement;

          // Match the childType and childName with the workspace elements
          const matchFound = ase.getWorkspaceElements().some(we => {
            if (we.getFullName() === childName && we.getMetadataName() === childType) {
              matchingWorkspaceElement = we;
              return true;
            }
            return false;
          });
          if (matchFound) {
            // debug('Found matching source element:', matchingWorkspaceElement.toObject(), 'in package:', ase.getPackageName());
            // Clone the ASE so as not to mutate, then set the workspace elements
            // for the cloned ASE to be the one matched.
            const clonedAse = new AggregateSourceElement(
              ase.getMetadataType(),
              ase.getAggregateFullName(),
              ase.getMetadataFilePath(),
              ase.metadataRegistry
            );
            clonedAse.workspaceElements = [matchingWorkspaceElement];
            returnValue = clonedAse;
          }
        }
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

  /**
   * Merges `AggregateSourceElements` and their corresponding `WorkspaceElements` with their
   * corresponding package directory names.
   * Note that 2 `AggregateSourceElements` with identical `AggregateSourceElement` key entries
   * (i.e., same CustomObject) but with different `WorkspaceElements` will simply add all
   * missing `WorkspaceElements` from the merging ASE to the existing ASE.
   *
   * @param aggregateSourceElements The other `AggregateSourceElements` to merge with this one.
   */
  public merge(aggregateSourceElements: AggregateSourceElements) {
    aggregateSourceElements.forEach((aseMap, packageName) => {
      if (this.has(packageName)) {
        const elements = this.get(packageName);
        aseMap.forEach((ase, key) => {
          const existingAse = elements.get(key);
          if (existingAse) {
            // Both AggregateSourceElements have an ASE key in the same package,
            // so add any missing WorkspaceElements from the merging ASE
            // to the existing ASE.
            const weFullNames = existingAse.getWorkspaceElements().map(we => we.getFullName());
            ase.getWorkspaceElements().forEach(we => {
              if (!weFullNames.includes(we.getFullName())) {
                existingAse.addWorkspaceElement(we);
              }
            });
          } else {
            elements.set(key, ase);
          }
        });
      } else {
        this.set(packageName, aseMap);
      }
    });
    return this;
  }
}

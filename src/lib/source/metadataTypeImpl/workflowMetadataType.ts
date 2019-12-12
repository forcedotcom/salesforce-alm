import { NondecomposedTypesWithChildrenMetadataType } from './nondecomposedTypesWithChildrenMetadataType';

export class WorkflowMetadataType extends NondecomposedTypesWithChildrenMetadataType {
  getAggregateFullNameFromSourceMemberName(sourceMemberName: string): string {
    return sourceMemberName.split('.')[0];
  }
}

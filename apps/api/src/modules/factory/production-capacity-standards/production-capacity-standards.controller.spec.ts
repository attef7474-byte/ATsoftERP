import 'reflect-metadata';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { ProductionCapacityStandardsController } from './production-capacity-standards.controller';

describe('ProductionCapacityStandardsController permissions', () => {
  const permission = (method: keyof ProductionCapacityStandardsController) => Reflect.getMetadata(PERMISSIONS_KEY, ProductionCapacityStandardsController.prototype[method]);

  it('uses distinct workflow permissions rather than a generic status update permission', () => {
    expect(permission('approve')).toEqual(['production-capacity-standard:approve']);
    expect(permission('suspend')).toEqual(['production-capacity-standard:suspend']);
    expect(permission('reactivate')).toEqual(['production-capacity-standard:reactivate']);
    expect(permission('archive')).toEqual(['production-capacity-standard:archive']);
    expect(permission('resolve')).toEqual(['production-capacity-standard:resolve']);
  });
});

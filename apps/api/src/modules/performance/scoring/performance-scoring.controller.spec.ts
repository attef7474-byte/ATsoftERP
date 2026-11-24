import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { PerformanceScoringController } from './performance-scoring.controller';
import { PerformanceProfilesController } from '../profiles/performance-profiles.controller';

describe('PerformanceScoringController routes/permissions', () => {
  it('PHASE3_ROUTE_COLLISIONS=0: controller base path is performance and explicit endpoints exist', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PerformanceScoringController)).toBe('performance');
    const proto = PerformanceScoringController.prototype as any;
    const methods = Object.getOwnPropertyNames(proto).filter(m => m !== 'constructor');
    const paths = methods.map(m => Reflect.getMetadata(PATH_METADATA, proto[m])).filter(Boolean);
    expect(paths).toEqual(expect.arrayContaining(['targets','weights','scoring-rules','profiles/:id/readiness','configuration-coverage','simulate']));
  });

  it('profiles controller :id does not capture readiness (different segment depth)', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PerformanceProfilesController)).toBe('performance/profiles');
    const proto = PerformanceProfilesController.prototype as any;
    const paths = Object.getOwnPropertyNames(proto).filter(m=>m!=='constructor').map(m=>Reflect.getMetadata(PATH_METADATA, proto[m]));
    // profiles has :id, not :id/readiness; readiness is registered on performance controller as profiles/:id/readiness
    expect(paths).toContain(':id');
    expect(paths).not.toContain(':id/readiness');
  });

  it('PHASE3_PERMISSION_TESTS metadata present for key handlers', () => {
    const proto = PerformanceScoringController.prototype as any;
    const getPerms = (m: string) => Reflect.getMetadata('permissions', proto[m]);
    expect(getPerms('listTargets')).toEqual(['performance-target:read']);
    expect(getPerms('createTarget')).toEqual(['performance-target:create']);
    expect(getPerms('createWeight')).toEqual(['performance-weight:create']);
    expect(getPerms('deactivateRule')).toEqual(['performance-scoring-rule:deactivate']);
    expect(getPerms('simulate')).toEqual(['performance-simulation:read']);
    expect(getPerms('coverage')).toEqual(['performance-config-coverage:read']);
  });
});

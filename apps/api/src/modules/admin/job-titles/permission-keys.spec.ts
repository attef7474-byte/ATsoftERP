import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CanActivate } from '@nestjs/common';
import { JobTitlesController } from './job-titles.controller';
import { JobTitlesService } from './job-titles.service';
import { PersonAssignmentsController } from '../person-assignments/person-assignments.controller';
import { PersonAssignmentsService } from '../person-assignments/person-assignments.service';
import { SupervisorAssignmentsController } from '../supervisor-assignments/supervisor-assignments.controller';
import { SupervisorAssignmentsService } from '../supervisor-assignments/supervisor-assignments.service';
import { DepartmentsController } from '../departments/departments.controller';
import { DepartmentsService } from '../departments/departments.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';

const PERMISSIONS_KEY = 'permissions';
const AlwaysTrueGuard: CanActivate = { canActivate: () => true };

describe('Batch A Module Permission Keys', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  function getPermissions(target: any, methodName: string): string[] {
    const handler = target[methodName];
    return reflector.get<string[]>(PERMISSIONS_KEY, handler) ?? [];
  }

  describe('JobTitlesController permissions', () => {
    let controller: JobTitlesController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [JobTitlesController],
        providers: [{ provide: JobTitlesService, useValue: {} }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(AlwaysTrueGuard)
        .overrideGuard(PermissionsGuard)
        .useValue(AlwaysTrueGuard)
        .compile();
      controller = module.get(JobTitlesController);
    });

    it('POST requires job-title:create', () => {
      expect(getPermissions(controller, 'create')).toContain('job-title:create');
    });

    it('GET / requires job-title:read', () => {
      expect(getPermissions(controller, 'findAll')).toContain('job-title:read');
    });

    it('GET /:id requires job-title:read', () => {
      expect(getPermissions(controller, 'findOne')).toContain('job-title:read');
    });

    it('PATCH /:id requires job-title:update', () => {
      expect(getPermissions(controller, 'update')).toContain('job-title:update');
    });

    it('DELETE /:id requires job-title:delete', () => {
      expect(getPermissions(controller, 'remove')).toContain('job-title:delete');
    });

    it('all four CRUD permissions are distinct', () => {
      const all = [
        ...getPermissions(controller, 'create'),
        ...getPermissions(controller, 'findAll'),
        ...getPermissions(controller, 'update'),
        ...getPermissions(controller, 'remove'),
      ];
      const unique = [...new Set(all)];
      expect(unique).toEqual(expect.arrayContaining(['job-title:create', 'job-title:read', 'job-title:update', 'job-title:delete']));
      expect(unique.length).toBe(4);
    });
  });

  describe('PersonAssignmentsController permissions', () => {
    let controller: PersonAssignmentsController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [PersonAssignmentsController],
        providers: [{ provide: PersonAssignmentsService, useValue: {} }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(AlwaysTrueGuard)
        .overrideGuard(PermissionsGuard)
        .useValue(AlwaysTrueGuard)
        .compile();
      controller = module.get(PersonAssignmentsController);
    });

    it('POST requires person-assignment:create', () => {
      expect(getPermissions(controller, 'create')).toContain('person-assignment:create');
    });

    it('GET / requires person-assignment:read', () => {
      expect(getPermissions(controller, 'findAll')).toContain('person-assignment:read');
    });

    it('GET /person/:personnelId requires person-assignment:read', () => {
      expect(getPermissions(controller, 'findByPerson')).toContain('person-assignment:read');
    });

    it('GET /:id requires person-assignment:read', () => {
      expect(getPermissions(controller, 'findOne')).toContain('person-assignment:read');
    });

    it('PATCH /:id requires person-assignment:update', () => {
      expect(getPermissions(controller, 'update')).toContain('person-assignment:update');
    });

    it('POST /:id/transfer requires person-assignment:transfer', () => {
      expect(getPermissions(controller, 'transfer')).toContain('person-assignment:transfer');
    });

    it('DELETE /:id requires person-assignment:update', () => {
      expect(getPermissions(controller, 'remove')).toContain('person-assignment:update');
    });
  });

  describe('SupervisorAssignmentsController permissions', () => {
    let controller: SupervisorAssignmentsController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [SupervisorAssignmentsController],
        providers: [{ provide: SupervisorAssignmentsService, useValue: {} }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(AlwaysTrueGuard)
        .overrideGuard(PermissionsGuard)
        .useValue(AlwaysTrueGuard)
        .compile();
      controller = module.get(SupervisorAssignmentsController);
    });

    it('POST requires supervisor:assign', () => {
      expect(getPermissions(controller, 'create')).toContain('supervisor:assign');
    });

    it('GET / requires supervisor:read', () => {
      expect(getPermissions(controller, 'findAll')).toContain('supervisor:read');
    });

    it('GET /reporting-line/:assignmentId requires supervisor:read', () => {
      expect(getPermissions(controller, 'getReportingLine')).toContain('supervisor:read');
    });

    it('GET /subordinates/:assignmentId requires supervisor:read', () => {
      expect(getPermissions(controller, 'getSubordinates')).toContain('supervisor:read');
    });

    it('GET /:id requires supervisor:read', () => {
      expect(getPermissions(controller, 'findOne')).toContain('supervisor:read');
    });

    it('PATCH /:id requires supervisor:assign', () => {
      expect(getPermissions(controller, 'update')).toContain('supervisor:assign');
    });

    it('DELETE /:id requires supervisor:remove', () => {
      expect(getPermissions(controller, 'remove')).toContain('supervisor:remove');
    });
  });

  describe('DepartmentsController permissions', () => {
    let controller: DepartmentsController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [DepartmentsController],
        providers: [{ provide: DepartmentsService, useValue: {} }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(AlwaysTrueGuard)
        .overrideGuard(PermissionsGuard)
        .useValue(AlwaysTrueGuard)
        .compile();
      controller = module.get(DepartmentsController);
    });

    it('POST requires department:create', () => {
      expect(getPermissions(controller, 'create')).toContain('department:create');
    });

    it('GET / requires department:read', () => {
      expect(getPermissions(controller, 'findAll')).toContain('department:read');
    });

    it('GET /tree requires department:read', () => {
      expect(getPermissions(controller, 'getTree')).toContain('department:read');
    });

    it('GET /:id requires department:read', () => {
      expect(getPermissions(controller, 'findOne')).toContain('department:read');
    });

    it('PATCH /:id requires department:update', () => {
      expect(getPermissions(controller, 'update')).toContain('department:update');
    });

    it('POST /:id/classify requires department:classify', () => {
      expect(getPermissions(controller, 'classify')).toContain('department:classify');
    });

    it('DELETE /:id requires department:delete', () => {
      expect(getPermissions(controller, 'remove')).toContain('department:delete');
    });
  });
});

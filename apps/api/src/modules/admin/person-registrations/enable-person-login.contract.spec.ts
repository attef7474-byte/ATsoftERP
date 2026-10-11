import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { EnablePersonLoginDto } from './dto/enable-person-login.dto';
import { PersonRegistrationsController } from './person-registrations.controller';

describe('first-time login endpoint contract', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: EnablePersonLoginDto });
  const credential = () => require('crypto').randomBytes(24).toString('base64');
  it('accepts only explicit email and password', async () => {
    const body = { email: 'a@tenant.test', password: credential() };
    expect(Boolean(await validate(body))).toBe(true);
  });
  it.each(['roleIds', 'companyId', 'branchId', 'userId', 'name', 'confirmPassword', 'category', 'placement'])('rejects unknown %s', async (field) => {
    await expect(validate({ email: 'a@tenant.test', password: credential(), [field]: 'forged' })).rejects.toBeDefined();
  });
  it.each([{ email: 'invalid', password: 'x' }, { email: 'a@tenant.test' }, { email: 'a@tenant.test', password: '' }])('rejects malformed/missing required input', async (body) => {
    await expect(validate(body)).rejects.toBeDefined();
  });
  it('requires person update and user creation in the controller', () => {
    const handler = PersonRegistrationsController.prototype.enableLogin;
    expect(Reflect.getMetadata('permissions', handler)).toEqual(['operational-person:update', 'user:create']);
    expect(Reflect.getMetadata('path', handler)).toBe(':id/enable-login');
  });
  it('delegates exact target and context to the canonical service', async () => {
    const service = { enableLogin: jest.fn().mockResolvedValue({ id: 'p1' }) };
    const controller = new PersonRegistrationsController(service as never);
    const dto = { email: 'a@tenant.test', password: credential() };
    await controller.enableLogin('p1', dto, { companyId: 'c', branchId: 'b' } as never, 'actor');
    expect(service.enableLogin.mock.calls[0][0]).toBe('p1');
    expect(service.enableLogin.mock.calls[0][1] === dto).toBe(true);
  });
});

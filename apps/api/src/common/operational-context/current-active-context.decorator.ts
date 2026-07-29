import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActiveOperationalContext } from './operational-context.types';

export const CurrentActiveContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ActiveOperationalContext | undefined =>
    context.switchToHttp().getRequest().activeContext,
);

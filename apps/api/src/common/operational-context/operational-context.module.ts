import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActiveContextInterceptor } from './active-context.interceptor';
import { ActiveContextService } from './active-context.service';
import { ActiveContextValidator } from './active-context.validator';
import { AllowedContextResolver } from './allowed-context.resolver';
import { ArchivedContextValidator } from './archived-context.validator';

@Global()
@Module({
  providers: [
    AllowedContextResolver,
    ActiveContextValidator,
    ArchivedContextValidator,
    ActiveContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ActiveContextInterceptor,
    },
  ],
  exports: [
    AllowedContextResolver,
    ActiveContextValidator,
    ArchivedContextValidator,
    ActiveContextService,
  ],
})
export class OperationalContextModule {}

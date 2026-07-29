import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActiveContextInterceptor } from './active-context.interceptor';
import { ActiveContextService } from './active-context.service';
import { ActiveContextValidator } from './active-context.validator';
import { AllowedContextResolver } from './allowed-context.resolver';

@Global()
@Module({
  providers: [
    AllowedContextResolver,
    ActiveContextValidator,
    ActiveContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ActiveContextInterceptor,
    },
  ],
  exports: [
    AllowedContextResolver,
    ActiveContextValidator,
    ActiveContextService,
  ],
})
export class OperationalContextModule {}

import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function loadRootEnv(): void {
  let dir = __dirname;
  for (let depth = 0; depth < 10; depth += 1) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      config({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  config({ path: '.env' });
}

loadRootEnv();

import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { transformValidationErrors } from './common/validation/validation-error-transformer';

async function validateProductionConfig(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv !== 'production') return;

  const warnings: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET is missing or too short (minimum 32 characters)');
  }
  if (!process.env.CORS_ORIGINS) {
    warnings.push('CORS_ORIGINS is not set — CORS is disabled (no cross-origin requests allowed)');
  }
  if (!process.env.SWAGGER_ENABLED) {
    warnings.push('Swagger is disabled (SWAGGER_ENABLED not set)');
  }
  if (process.env.SEED_ADMIN_PASSWORD && process.env.SEED_ADMIN_PASSWORD !== 'CHANGE_ME_LOCALLY') {
    warnings.push('SEED_ADMIN_PASSWORD is set — ensure it is not used in production');
  }

  if (warnings.length > 0) {
    console.warn('\n========================================');
    console.warn('PRODUCTION CONFIG WARNINGS:');
    warnings.forEach((w) => console.warn(`  - ${w}`));
    console.warn('========================================\n');
  }
}

async function bootstrap() {
  await validateProductionConfig();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        return new BadRequestException({
          messageKey: 'common.validationFailed',
          message: 'Validation failed',
          errors: transformValidationErrors(errors),
        });
      },
    }),
  );

  const nodeEnv = process.env.NODE_ENV || 'development';
  const corsOriginsRaw = process.env.CORS_ORIGINS || '';
  const isProduction = nodeEnv === 'production';

  if (isProduction && !corsOriginsRaw) {
    console.warn(
      'WARNING: CORS_ORIGINS is not set in production mode. CORS is disabled (no cross-origin requests allowed).',
    );
    app.enableCors({ origin: false });
  } else if (corsOriginsRaw) {
    const allowedOrigins = corsOriginsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
    });
  } else {
    app.enableCors();
  }

  const swaggerEnabled = process.env.SWAGGER_ENABLED === 'true' || !isProduction;
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ATsoft ERP API')
      .setDescription('Enterprise Resource Planning API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}
bootstrap();

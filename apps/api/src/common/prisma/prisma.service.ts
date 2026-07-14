import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const rawUrl = process.env.DATABASE_URL!;
    const params: Record<string, string> = {};
    for (const part of rawUrl.split(';').slice(1)) {
      const idx = part.indexOf('=');
      if (idx > 0) params[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
    const serverPort = rawUrl.replace('sqlserver://', '').split(';')[0];
    const colonIdx = serverPort.indexOf(':');
    const server = colonIdx > 0 ? serverPort.slice(0, colonIdx) : serverPort;
    const port = colonIdx > 0 ? parseInt(serverPort.slice(colonIdx + 1), 10) : 1433;

    const config = {
      server,
      port,
      database: params['database'] || '',
      user: params['user'] || '',
      password: params['password'] || '',
      options: {
        trustServerCertificate: params['trustServerCertificate'] === 'true',
      },
    };
    const adapter = new PrismaMssql(config as any);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import { getDatabaseConfig } from './config.js';

export function createPrismaClient() {
  const adapter = new PrismaMariaDb(getDatabaseConfig());
  return new PrismaClient({
    adapter,
    log: process.env.PRISMA_QUERY_LOG === '1'
      ? [{ emit: 'stdout', level: 'query' }, { emit: 'stdout', level: 'error' }, { emit: 'stdout', level: 'warn' }]
      : [{ emit: 'stdout', level: 'error' }, { emit: 'stdout', level: 'warn' }],
  });
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;

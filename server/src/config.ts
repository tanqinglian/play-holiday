import 'dotenv/config';

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function integer(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`环境变量 ${name} 必须是正整数`);
  return value;
}

export function getDatabaseConfig() {
  return {
    host: required('DATABASE_HOST'),
    port: integer('DATABASE_PORT', 3306),
    user: required('DATABASE_USER'),
    password: required('DATABASE_PASSWORD'),
    database: required('DATABASE_NAME'),
    connectionLimit: 5,
    connectTimeout: 5_000,
    acquireTimeout: 10_000,
    idleTimeout: 300,
  };
}

export function getServerConfig() {
  const port = Number(process.env.SERVER_PORT ?? process.env.PORT ?? 3100);
  if (!Number.isInteger(port) || port <= 0) throw new Error('环境变量 SERVER_PORT/PORT 必须是正整数');
  return {
    host: process.env.SERVER_HOST || '127.0.0.1',
    port,
  };
}

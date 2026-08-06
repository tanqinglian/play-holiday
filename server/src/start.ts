import { buildApp } from './app.js';
import { getServerConfig } from './config.js';
import { createPrismaClient } from './db.js';
import { PrismaPlaceRepository } from './repositories/prisma-place-repository.js';
import { PrismaImageRepository } from './repositories/prisma-image-repository.js';
import { SharpImageCodec } from './services/image-service.js';
import { MysqlImageService } from './services/image-storage-service.js';
import { OpenMeteoWeatherService } from './services/weather-service.js';

const prisma = createPrismaClient();
const app = buildApp({
  repository: new PrismaPlaceRepository(prisma),
  imageService: new MysqlImageService(new PrismaImageRepository(prisma), new SharpImageCodec()),
  weatherService: new OpenMeteoWeatherService({
    baseUrl: process.env.WEATHER_API_BASE_URL,
    apiKey: process.env.WEATHER_API_KEY,
  }),
});
const config = getServerConfig();

async function shutdown(signal: string) {
  app.log.info({ signal }, 'server shutdown started');
  await app.close();
  await prisma.$disconnect();
  app.log.info('server shutdown complete');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal)
      .then(() => process.exit(0))
      .catch((error) => {
        app.log.error({ err: error }, 'server shutdown failed');
        process.exit(1);
      });
  });
}

try {
  await prisma.$connect();
  await app.listen(config);
  app.log.info({ ...config }, 'play-holiday API ready');
} catch (error) {
  app.log.fatal({ err: error }, 'server startup failed');
  await prisma.$disconnect();
  process.exit(1);
}

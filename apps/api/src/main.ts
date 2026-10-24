import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config';
import { AllErrorsFilter, validationException } from './common/errors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: validationException,
  }));
  app.useGlobalFilters(new AllErrorsFilter());
  app.enableShutdownHooks();
  await app.listen(config.port);
  new Logger('Bootstrap').log(`API روی پورت ${config.port}`);
}
bootstrap();

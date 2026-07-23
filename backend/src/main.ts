import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // за Traefik/nginx реальный IP клиента приходит в X-Forwarded-For — иначе
  // throttler считал бы весь трафик «с одного IP» (адреса прокси)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(helmet());
  // CORS ограничен origin фронта (в проде — https://sitehrportal.ru); '*' убран
  const origin = process.env.FRONTEND_ORIGIN;
  app.enableCors({ origin: origin ? origin.split(',').map(o => o.trim()) : true, credentials: true });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();

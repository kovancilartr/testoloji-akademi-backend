import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createRouteHandler } from "uploadthing/express";
import { uploadRouter } from "./common/config/upload-router";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors();

  // UploadThing
  app.use(
    "/api/uploadthing",
    createRouteHandler({
      router: uploadRouter,
    }),
  );

  // Global Interceptor
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new TransformInterceptor(reflector));

  // Global Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      forbidNonWhitelisted: false,
    }),
  );

  await app.listen(process.env.PORT ?? 4001);
  console.log(`NestJS Backend is running on: ${await app.getUrl()}`);
}
bootstrap();

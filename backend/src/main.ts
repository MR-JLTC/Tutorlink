import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS so the frontend can communicate with the backend
  app.enableCors({
    origin: '*', // For development, allow any origin. For production, restrict this to your frontend's domain.
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Set a global prefix for all routes except the root path
  app.setGlobalPrefix('api', {
    exclude: ['/']
  });

  // Use global pipes for validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(3000);
}
bootstrap();

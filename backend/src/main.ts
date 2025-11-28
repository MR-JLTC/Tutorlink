import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS so the frontend can communicate with the backend
  const allowedOrigins = process.env.FRONTEND_URL 
    ? [process.env.FRONTEND_URL, 'http://localhost:3001']
    : ['http://localhost:3001', '*']; // Fallback for development
  
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? allowedOrigins.filter(origin => origin !== '*')
      : '*', // Allow all origins in development
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Ensure uploads folder exists and serve static files for tutor documents
  const docsDir = join(process.cwd(), 'tutor_documents');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  // Serve at /tutor_documents/* - configure before global prefix
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  app.use('/tutor_documents', express.static(docsDir, {
    setHeaders: (res, path) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
  }));

  // Ensure user_profile_images folder exists and serve static files for user profile images
  const userProfileImagesDir = join(process.cwd(), 'user_profile_images');
  if (!fs.existsSync(userProfileImagesDir)) {
    fs.mkdirSync(userProfileImagesDir, { recursive: true });
  }
  app.use('/user_profile_images', express.static(userProfileImagesDir, {
    setHeaders: (res, path) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
  }));

  // Ensure admin_qr folder exists and serve static files for admin qr images
  const adminQrDir = join(process.cwd(), 'admin_qr');
  if (!fs.existsSync(adminQrDir)) {
    fs.mkdirSync(adminQrDir, { recursive: true });
  }
  app.use('/admin_qr', express.static(adminQrDir, {
    setHeaders: (res, path) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
  }));

  // Set a global prefix for all routes except the root path
  app.setGlobalPrefix('api', {
    exclude: ['/']
  });

  // Use global pipes for validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server is running on port ${port}`);
}
bootstrap();

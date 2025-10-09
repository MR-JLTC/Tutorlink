import { Module, Controller, Get } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { UniversitiesModule } from './universities/universities.module';
import { CoursesModule } from './courses/courses.module';
import { TutorsModule } from './tutors/tutors.module';
import { PaymentsModule } from './payments/payments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import * as entities from './database/entities';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      message: 'TutorLink API is running!',
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth',
        courses: '/api/courses',
        universities: '/api/universities',
        tutors: '/api/tutors',
        payments: '/api/payments',
        dashboard: '/api/dashboard'
      }
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root', // Default XAMPP username
      password: '',     // Default XAMPP password is empty
      database: 'tutorlink',
      entities: Object.values(entities),
      synchronize: true, // Note: synchronize: true is not recommended for production
    }),
    AuthModule,
    UsersModule,
    UniversitiesModule,
    CoursesModule,
    TutorsModule,
    PaymentsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}

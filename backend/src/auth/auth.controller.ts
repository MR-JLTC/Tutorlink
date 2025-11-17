import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('register-student')
  async registerStudent(@Body() body: { name: string; email: string; password: string; university_id: number; course_id?: number; course_name?: string; year_level: number }) {
    return this.authService.registerStudent(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('admin-availability')
  async getAdminAvailability() {
    const hasAdmin = await this.usersService.hasAdmin();
    return {
      hasAdmin,
      canRegister: !hasAdmin,
    };
  }

  @Post('login-tutor-tutee')
  @HttpCode(HttpStatus.OK)
  async loginTutorTutee(@Body() loginDto: LoginDto) {
    return this.authService.loginTutorTutee(loginDto);
  }
}

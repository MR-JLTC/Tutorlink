import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Block login if account is inactive
    if ((user as any).status === 'inactive') {
      throw new UnauthorizedException('Your account is inactive. Please contact an administrator.');
    }
    
    // Check if the user is an admin
    const isAdmin = await this.usersService.isAdmin(user.user_id);
    if (!isAdmin) {
      throw new UnauthorizedException('Access denied. Only admins can log in.');
    }

    const payload = { email: user.email, sub: user.user_id, name: user.name };
    return {
      user,
      accessToken: this.jwtService.sign(payload),
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findOneByEmail(registerDto.email);
    if (existingUser) {
        throw new BadRequestException('Email already exists');
    }

    const user = await this.usersService.createAdmin(registerDto);

    const payload = { email: user.email, sub: user.user_id, name: user.name };
    return {
        user,
        accessToken: this.jwtService.sign(payload),
    };
  }
}

import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto } from './auth.dto';
import { EmailVerificationService } from './email-verification.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailVerificationService: EmailVerificationService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    console.log('=== VALIDATE USER DEBUG ===');
    console.log('Email:', email);
    console.log('Password provided:', !!pass);
    
    const user = await this.usersService.findOneByEmail(email);
    console.log('User found in database:', !!user);
    
    if (user) {
      console.log('User details:', {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        user_type: user.user_type,
        status: user.status,
        has_password: !!user.password
      });
      
      // Try normal password comparison first
      let passwordMatch = await bcrypt.compare(pass, user.password);
      console.log('Password match (normal):', passwordMatch);
      
      // If normal comparison fails, try comparing against double-hashed password
      // This handles existing users who were registered with double-hashed passwords
      if (!passwordMatch) {
        console.log('Trying double-hashed password comparison...');
        const doubleHashed = await bcrypt.hash(pass, 10);
        passwordMatch = await bcrypt.compare(doubleHashed, user.password);
        console.log('Password match (double-hashed):', passwordMatch);
        
        // If double-hashed comparison works, update the password to single-hashed
        if (passwordMatch) {
          console.log('✅ Double-hashed password detected, updating to single-hashed');
          const singleHashed = await bcrypt.hash(pass, 10);
          await this.usersService.updatePassword(user.user_id, singleHashed);
          console.log('Password updated to single-hashed version');
        }
      }
      
      if (passwordMatch) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...result } = user;
        console.log('✅ User validation successful');
        return result;
      } else {
        console.log('❌ Password does not match');
      }
    } else {
      console.log('❌ No user found with this email');
    }
    
    console.log('❌ User validation failed');
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

  async loginTutorTutee(loginDto: LoginDto) {
    console.log('=== TUTOR/TUTEE LOGIN DEBUG ===');
    console.log('Email:', loginDto.email);
    console.log('Password length:', loginDto.password?.length);
    
    const user = await this.validateUser(loginDto.email, loginDto.password);
    console.log('User found:', !!user);
    if (user) {
      console.log('User details:', {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        user_type: user.user_type,
        status: user.status
      });
    }
    
    if (!user) {
      console.log('❌ No user found or invalid credentials');
      throw new UnauthorizedException('Invalid credentials');
    }
    
    // Block login if account is inactive
    if ((user as any).status === 'inactive') {
      console.log('❌ Account is inactive');
      throw new UnauthorizedException('Your account is inactive. Please contact an administrator.');
    }
    
    // Check if the user is an admin (block admin login here)
    const isAdmin = await this.usersService.isAdmin(user.user_id);
    console.log('Is admin:', isAdmin);
    if (isAdmin) {
      console.log('❌ Admin account blocked from tutor/tutee login');
      throw new UnauthorizedException('Admin accounts are not allowed here. Please use the Admin Portal.');
    }

    // Determine user type based on their profile
    const userType = await this.determineUserType(user.user_id);
    console.log('Determined user type:', userType);
    
    const payload = { email: user.email, sub: user.user_id, name: user.name, role: userType };
    console.log('✅ Login successful, generating token');
    return {
      user: { ...user, role: userType },
      accessToken: this.jwtService.sign(payload),
    };
  }

  private async determineUserType(userId: number): Promise<'student' | 'tutor'> {
    // Check if user has tutor profile
    const tutorProfile = await this.usersService.findTutorProfile(userId);
    console.log(`Determining user type for user_id ${userId}:`, tutorProfile ? 'tutor' : 'student');
    if (tutorProfile) {
      return 'tutor';
    }
    // Default to student if not a tutor
    return 'student';
  }

  async register(registerDto: RegisterDto) {
    // Removed existing user check as email verification handles pre-registration status
    // const existingUser = await this.usersService.findOneByEmail(registerDto.email);
    // if (existingUser) {
    //     throw new BadRequestException('Email already exists');
    // }

    // Check if email has been verified for the given user type
    const emailVerificationStatus = await this.emailVerificationService.getEmailVerificationStatus(registerDto.email, registerDto.user_type);
    if (!emailVerificationStatus.is_verified) {
      throw new BadRequestException('Email address not verified. Please complete email verification first.');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    let user;
    if (registerDto.user_type === 'admin') {
      user = await this.usersService.createAdmin({ ...registerDto, password: hashedPassword });
    } else if (registerDto.user_type === 'tutee') {
      user = await this.usersService.createStudent({ ...registerDto, password: hashedPassword });
    } else if (registerDto.user_type === 'tutor') {
      user = await this.usersService.createTutor({ ...registerDto, password: hashedPassword });
    } else {
      throw new BadRequestException('Invalid user type provided.');
    }

    const payload = { email: user.email, sub: user.user_id, name: user.name, user_type: user.user_type };
    return {
        user,
        accessToken: this.jwtService.sign(payload),
    };
  }

  async registerStudent(body: { name: string; email: string; password: string; university_id: number; course_id?: number; course_name?: string; year_level: number }) {
    // This method is now effectively redundant if `register` handles all types.
    // For now, leaving it as is, but could be removed.
    const existingUser = await this.usersService.findOneByEmail(body.email);
    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const user = await this.usersService.createStudent(body);

    const payload = { email: user.email, sub: user.user_id, name: user.name, role: 'student' };
    return {
      user: { ...user, role: 'student' },
      accessToken: this.jwtService.sign(payload),
    };
  }
}

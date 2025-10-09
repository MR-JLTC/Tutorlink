import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'SECRET_KEY_REPLACE_IN_PROD', // Must match the secret in auth.module
    });
  }

  async validate(payload: any) {
    // This payload is the decoded JWT
    const user = await this.usersService.findOneById(payload.sub);
    if (!user) {
        throw new UnauthorizedException();
    }
    // The returned value will be attached to the request object as `req.user`
    return { userId: payload.sub, email: payload.email, name: payload.name };
  }
}

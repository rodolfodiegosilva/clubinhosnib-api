import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly userService: UserService,

  ) {}

  async login(dto: LoginDto) {
    const user = await this.authRepo.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
  
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');
  
    const payload = { sub: user.id, email: user.email };
  
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });
  
    await this.userService.updateRefreshToken(user.id, refreshToken);
  
    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
      refreshToken,
    };
  }
  
  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
  
      const user = await this.userService.findOne(payload.sub);
  
      if (!user || user.refreshToken !== token) {
        throw new UnauthorizedException('Refresh token invalid');
      }
  
      const newPayload = { sub: user.id, email: user.email };
  
      const accessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
      });
  
      await this.userService.updateRefreshToken(user.id, newRefreshToken);
  
      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
  
  async logout(userId: string) {
    await this.userService.updateRefreshToken(userId, null);
    return { message: 'User logged out' };
  }
  
}

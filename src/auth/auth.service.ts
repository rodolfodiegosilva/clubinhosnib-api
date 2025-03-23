import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly userService: UserService,
  ) {}

  async login(dto: LoginDto) {
    this.logger.debug(`Tentando login para o email: ${dto.email}`);
    const user = await this.authRepo.validateUser(dto.email, dto.password);
    if (!user) {
      this.logger.warn(`Credenciais inválidas para o email: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Senha inválida para o email: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    await this.userService.updateRefreshToken(user.id, refreshToken);

    this.logger.debug(`Login bem-sucedido para o email: ${dto.email}`);
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
      this.logger.debug('Tentando refresh token');
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userService.findOne(payload.sub);

      if (!user || user.refreshToken !== token) {
        this.logger.warn('Refresh token inválido');
        throw new UnauthorizedException('Refresh token invalid');
      }

      const newPayload = { sub: user.id, email: user.email };

      const accessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
      });

      await this.userService.updateRefreshToken(user.id, newRefreshToken);

      this.logger.debug('Refresh token bem-sucedido');
      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (e) {
      this.logger.error('Erro ao tentar refresh token', e.stack);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    this.logger.debug(`Logout para o usuário ID: ${userId}`);
    await this.userService.updateRefreshToken(userId, null);
    return { message: 'User logged out' };
  }
}

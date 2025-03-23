import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepo: UserRepository) {}

  async create(dto: CreateUserDto) {
    this.logger.debug(`Criando usuário com email: ${dto.email}`);
    try {
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      this.logger.debug(`Passou pelo bcrypt hash: ${dto.email}`);
      const user = await this.userRepo.create({ ...dto, password: hashedPassword });
      this.logger.debug(`Usuário criado com sucesso: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Erro ao criar usuário: ${error.message}`, error.stack);
      throw error;
    }
  }  

  async findAll() {
    this.logger.debug('Buscando todos os usuários');
    return this.userRepo.findAll();
  }

  async findOne(id: string) {
    this.logger.debug(`Buscando usuário com ID: ${id}`);
    const user = await this.userRepo.findById(id);
    if (!user) {
      this.logger.warn(`Usuário não encontrado com ID: ${id}`);
      throw new NotFoundException('User not found');
    }
    this.logger.debug(`Usuário encontrado: ${user.id}`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    this.logger.debug(`Atualizando usuário com ID: ${id}`);
    const user = await this.userRepo.update(id, dto);
    this.logger.debug(`Usuário atualizado com sucesso: ${user.id}`);
    return user;
  }

  async remove(id: string) {
    this.logger.debug(`Removendo usuário com ID: ${id}`);
    await this.userRepo.delete(id);
    this.logger.debug(`Usuário removido com sucesso: ${id}`);
    return { message: 'User deleted' };
  }

  async findByEmail(email: string) {
    this.logger.debug(`Buscando usuário com email: ${email}`);
    return this.userRepo.findByEmail(email);
  }

  async updateRefreshToken(userId: string, token: string | null) {
    this.logger.debug(`Atualizando refresh token para o usuário ID: ${userId}`);
    return this.userRepo.updateRefreshToken(userId, token);
  }
}

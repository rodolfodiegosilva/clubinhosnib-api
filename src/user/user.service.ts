import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async create(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.userRepo.create({ ...dto, password: hashedPassword });
  }

  async findAll() {
    return this.userRepo.findAll();
  }

  async findOne(id: string) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.userRepo.update(id, dto);
  }

  async remove(id: string) {
    await this.userRepo.delete(id);
    return { message: 'User deleted' };
  }

  async findByEmail(email: string) {
    return this.userRepo.findByEmail(email);
  }

  async updateRefreshToken(userId: string, token: string | null) {
    return this.userRepo.updateRefreshToken(userId, token);
  }
  
}

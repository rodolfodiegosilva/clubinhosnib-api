import { Injectable } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';

@Injectable()
export class AuthRepository {
  constructor(private readonly userRepo: UserRepository) {}

  async validateUser(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    return user;
  }
}

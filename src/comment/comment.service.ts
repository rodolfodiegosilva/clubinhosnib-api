import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentEntity } from './entity/comment.entity';
import { CommentRepository } from './repository/comment.repository';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentService {
  constructor(private readonly commentRepo: CommentRepository) {}

  async create(dto: CreateCommentDto): Promise<CommentEntity> {
    const comment = this.commentRepo.create(dto);
    return this.commentRepo.save(comment);
  }

  async findAllPublished(): Promise<CommentEntity[]> {
    return this.commentRepo.findAllPublished();
  } 
  
  async findAll(): Promise<CommentEntity[]> {
    return this.commentRepo.findAll();
  } 

  async findOne(id: string): Promise<CommentEntity> {
    const comment = await this.commentRepo.findOneBy({ id });
    if (!comment) {
      throw new NotFoundException('Comentário não encontrado');
    }
    return comment;
  }

  async update(id: string, dto: UpdateCommentDto): Promise<CommentEntity> {
    const comment = await this.findOne(id);
    Object.assign(comment, dto);
    return this.commentRepo.save(comment);
  }

  async remove(id: string): Promise<void> {
    const comment = await this.findOne(id);
    await this.commentRepo.remove(comment);
  }
}

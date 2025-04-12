import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    Delete,
    UsePipes,
    ValidationPipe,
    Logger,
  } from '@nestjs/common';
  import { CommentService } from './comment.service';
  import { CreateCommentDto } from './dto/create-comment.dto';
  import { CommentResponseDto } from './dto/comment-response.dto';
  import { plainToInstance } from 'class-transformer';
  import { UpdateCommentDto } from './dto/update-comment.dto';
  
  @Controller('comments')
  export class CommentController {
    private readonly logger = new Logger(CommentController.name);
  
    constructor(private readonly commentService: CommentService) {}
  
    @Post()
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async create(@Body() dto: CreateCommentDto): Promise<CommentResponseDto> {
      this.logger.log(`[POST /comments] Criando novo comentário com dados: ${JSON.stringify(dto)}`);
      const created = await this.commentService.create(dto);
      this.logger.log(`[POST /comments] Comentário criado com ID: ${created.id}`);
      return plainToInstance(CommentResponseDto, created);
    }
  
    @Get()
    async findAll(): Promise<CommentResponseDto[]> {
      this.logger.log('[GET /comments] Buscando todos os comentários');
      const comments = await this.commentService.findAll();
      this.logger.log(`[GET /comments] ${comments.length} comentário(s) encontrados`);
      return plainToInstance(CommentResponseDto, comments);
    }
  
    @Get('/published')
    async findAllPublished(): Promise<CommentResponseDto[]> {
      this.logger.log('[GET /comments/published] Buscando comentários publicados');
      const comments = await this.commentService.findAllPublished();
      this.logger.log(`[GET /comments/published] ${comments.length} comentário(s) publicados encontrados`);
      return plainToInstance(CommentResponseDto, comments);
    }
  
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<CommentResponseDto> {
      this.logger.log(`[GET /comments/${id}] Buscando comentário por ID`);
      const comment = await this.commentService.findOne(id);
      this.logger.log(`[GET /comments/${id}] Comentário encontrado`);
      return plainToInstance(CommentResponseDto, comment);
    }
  
    @Put(':id')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async update(
      @Param('id') id: string,
      @Body() dto: any,
    ): Promise<CommentResponseDto> {
      this.logger.log(`[PUT /comments/${id}] Atualizando comentário com dados: ${JSON.stringify(dto)}`);
      const updated = await this.commentService.update(id, dto);
      this.logger.log(`[PUT /comments/${id}] Comentário atualizado`);
      return plainToInstance(CommentResponseDto, updated);
    }
  
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<void> {
      this.logger.log(`[DELETE /comments/${id}] Removendo comentário`);
      await this.commentService.remove(id);
      this.logger.log(`[DELETE /comments/${id}] Comentário removido`);
    }
  }
  
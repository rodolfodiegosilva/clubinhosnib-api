import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  UploadedFiles,
  Body,
  UseInterceptors,
  BadRequestException,
  Logger,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { VideosPageService } from './video-page.service';
import { UpdateVideosPageDto } from './dto/update-videos-page.dto';
import { VideosPageResponseDto } from './dto/videos-page-response.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVideosPageDto } from './dto/create-videos-page.dto';

@Controller('video-pages')
export class VideosPageController {
  private readonly logger = new Logger(VideosPageController.name);

  constructor(private readonly videosPageService: VideosPageService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('videosPageData') raw: string,
  ): Promise<VideosPageResponseDto> {
    this.logger.debug('🚀 Recebendo requisição para criar uma nova página de vídeos');

    try {
      const parsedData = JSON.parse(raw);
      const dto = plainToInstance(CreateVideosPageDto, parsedData);

      const validationErrors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (validationErrors.length > 0) {
        this.logger.error('❌ Erros de validação no DTO:', JSON.stringify(validationErrors, null, 2));
        throw new BadRequestException('Dados inválidos na requisição');
      }

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      const result = await this.videosPageService.createVideosPage(dto, filesDict);
      this.logger.log(`✅ Página de vídeos criada com sucesso: ID=${result.id}`);

      return result;
    } catch (error) {
      this.logger.error('Erro ao criar página de vídeos', error);
      throw new BadRequestException('Erro ao criar a página de vídeos.');
    }
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('videosPageData') raw: string,
  ): Promise<VideosPageResponseDto> {
    this.logger.debug('🚀 Recebendo requisição para atualizar página de vídeos com ID:', id);

    try {
      const parsedData = JSON.parse(raw);
      const dto = plainToInstance(UpdateVideosPageDto, parsedData);

      const validationErrors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (validationErrors.length > 0) {
        this.logger.error('❌ Erros de validação no DTO:', JSON.stringify(validationErrors, null, 2));
        throw new BadRequestException('Dados inválidos na requisição');
      }

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      const result = await this.videosPageService.updateVideosPage(id, dto, filesDict);
      this.logger.log(`✅ Página de vídeos atualizada com sucesso: ID=${result.id}`);

      return result;
    } catch (error) {
      this.logger.error('Erro ao atualizar página de vídeos', error);
      throw new BadRequestException('Erro ao atualizar a página de vídeos.');
    }
  }

  @Get()
  async findAll(): Promise<VideosPageResponseDto[]> {
    return this.videosPageService.findAllPages();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<VideosPageResponseDto> {
    try {
      return await this.videosPageService.findOnePage(id);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new BadRequestException('Erro ao buscar página de vídeos.');
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.videosPageService.removePage(id);
    return { message: 'Página de vídeos removida com sucesso' };
  }
}
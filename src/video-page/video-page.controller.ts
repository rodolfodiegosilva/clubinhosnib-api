import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Logger,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Patch,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { VideosPageService } from './video-page.service';
import { VideosPageResponseDTO } from './dto/gallery-video-response.dto';

@Controller('videos-page')
export class VideosPageController {
  private readonly logger = new Logger(VideosPageController.name);

  constructor(private readonly videosPageService: VideosPageService) {}

  @Get()
  async findAll(): Promise<VideosPageResponseDTO[]> {
    const pages = await this.videosPageService.findAllPages();
    return pages.map(VideosPageResponseDTO.fromEntity);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<VideosPageResponseDTO> {
    const page = await this.videosPageService.findOnePage(id);
    return VideosPageResponseDTO.fromEntity(page);
  }

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('videosPageData') videosPageData: string,
  ): Promise<VideosPageResponseDTO> {
    try {
      this.logger.debug(`📥 Criando nova página de vídeos`);

      if (!videosPageData) throw new BadRequestException('videosPageData é obrigatório.');

      const dto: any = JSON.parse(videosPageData);

      if (!dto.videos || !Array.isArray(dto.videos)) {
        throw new BadRequestException('videos deve ser um array.');
      }

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      const savedPage = await this.videosPageService.createVideosPage(dto, filesDict);
      return VideosPageResponseDTO.fromEntity(savedPage);
    } catch (error) {
      this.logger.error('Erro ao criar página de vídeos:', error);
      throw new BadRequestException('Erro ao criar página de vídeos.');
    }
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('videosPageData') videosPageData: string,
  ): Promise<VideosPageResponseDTO> {
    try {
      this.logger.debug(`🛠️ Atualizando página de vídeos ID=${id}`);

      if (!videosPageData) throw new BadRequestException('videosPageData é obrigatório.');

      const dto: any = JSON.parse(videosPageData);

      if (!dto.videos || !Array.isArray(dto.videos)) {
        throw new BadRequestException('videos deve ser um array.');
      }

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      const updatedPage = await this.videosPageService.updateVideosPage(id, dto, filesDict);
      return VideosPageResponseDTO.fromEntity(updatedPage);
    } catch (error) {
      this.logger.error('Erro ao atualizar página de vídeos:', error);
      throw new BadRequestException('Erro ao atualizar página de vídeos.');
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ deleted: boolean }> {
    await this.videosPageService.removePage(id);
    return { deleted: true };
  }
}

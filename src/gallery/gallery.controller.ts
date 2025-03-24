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
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { GalleryService } from './gallery.service';
import { GalleryPageResponseDTO } from './dto/gallery-page-response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('gallery')
export class GalleryController {
  private readonly logger = new Logger(GalleryController.name);

  constructor(private readonly galleryService: GalleryService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async createGalleryPage(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('galleryData') galleryData: string,
  ): Promise<GalleryPageResponseDTO> {
    try {
      this.logger.debug('=== Criando nova página de galeria ===');

      if (!galleryData) throw new BadRequestException('galleryData é obrigatório.');

      const parsedData = JSON.parse(galleryData);
      const { title, description, items } = parsedData;
      if (!Array.isArray(items)) throw new BadRequestException('items deve ser um array.');

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      const adaptedData = {
        name: title,
        description,
        sections: items,
      };

      const savedPage = await this.galleryService.createGalleryPage(adaptedData, filesDict);
      return GalleryPageResponseDTO.fromEntity(savedPage);
    } catch (error) {
      this.logger.error('Erro ao criar galeria:', error);
      throw new BadRequestException('Erro ao criar a página de galeria.');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async updateGalleryPage(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('galleryData') galleryData: string,
  ): Promise<GalleryPageResponseDTO> {
    try {
      this.logger.debug(`=== Atualizando página de galeria ID=${id} ===`);

      if (!galleryData) throw new BadRequestException('galleryData é obrigatório.');

      const parsedData = JSON.parse(galleryData);
      const { title, description, items } = parsedData;
      if (!Array.isArray(items)) throw new BadRequestException('items deve ser um array.');

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      const adaptedData = {
        id,
        name: title,
        description,
        sections: items,
      };

      const updatedPage = await this.galleryService.updateGalleryPage(id, adaptedData, filesDict);
      return GalleryPageResponseDTO.fromEntity(updatedPage);
    } catch (error) {
      this.logger.error('Erro ao atualizar galeria:', error);
      throw new BadRequestException('Erro ao atualizar a página de galeria.');
    }
  }

  @Get()
  async findAll(): Promise<GalleryPageResponseDTO[]> {
    const pages = await this.galleryService.findAllPages();
    return pages.map(GalleryPageResponseDTO.fromEntity);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<GalleryPageResponseDTO> {
    const page = await this.galleryService.findOnePage(id);
    if (!page) throw new BadRequestException('Página de galeria não encontrada.');
    return GalleryPageResponseDTO.fromEntity(page);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async removePage(@Param('id') id: string) {
    await this.galleryService.removePage(id);
    return { message: 'Página de galeria removida com sucesso' };
  }
}

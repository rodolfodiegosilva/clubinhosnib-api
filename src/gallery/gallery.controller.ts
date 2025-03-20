import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  UploadedFiles,
  Body,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { GalleryService } from './gallery.service';

@Controller('gallery')
export class GalleryController {
  private readonly logger = new Logger(GalleryController.name);

  constructor(private readonly galleryService: GalleryService) { }

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async createGalleryPage(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('galleryData') galleryData: string,
  ) {
    try {
      this.logger.debug('=== Recebendo requisição para criar uma página de galeria ===');

      if (!galleryData) {
        this.logger.error('galleryData não foi enviado corretamente.');
        throw new BadRequestException('galleryData é obrigatório.');
      }

      this.logger.debug(`Raw galleryData recebido: ${galleryData}`);
      this.logger.debug(`Arquivos recebidos: ${files.length}`);

      let parsedData;
      try {
        parsedData = JSON.parse(galleryData);
      } catch (error) {
        this.logger.error('Erro ao fazer parse de galleryData:', error);
        throw new BadRequestException('galleryData inválido.');
      }

      const { title, description, items } = parsedData;

      if (!Array.isArray(items)) {
        this.logger.error('items deveria ser um array.');
        throw new BadRequestException('items deve ser um array.');
      }

      this.logger.debug(`Total de seções recebidas: ${items.length}`);

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => {
        filesDict[file.fieldname] = file;
      });

      this.logger.debug(`Arquivos mapeados: ${Object.keys(filesDict)}`);

      const adaptedData = {
        name: title,
        description,
        sections: items,
      };

      const savedPage = await this.galleryService.createGalleryPage(
        adaptedData,
        filesDict,
      );

      this.logger.debug(`Página de galeria criada: ID=${savedPage.id}, Nome="${savedPage.name}"`);

      const safeResult = {
        id: savedPage.id,
        name: savedPage.name,
        description: savedPage.description,
        sections: savedPage.sections.map((section) => ({
          id: section.id,
          caption: section.caption,
          description: section.description,
          images: section.images?.map((img) => ({
            id: img.id,
            url: img.url,
            isLocalFile: img.isLocalFile,
            originalName: img.originalName,
          })),
        })),
      };

      return safeResult;
    } catch (error) {
      this.logger.error('Erro ao processar requisição:', error);
      throw new BadRequestException('Erro ao criar a página de galeria.');
    }
  }

  @Get()
  async findAll() {
    this.logger.debug('Buscando todas as páginas de galeria...');

    const pages = await this.galleryService.findAllPages();

    const safeResult = pages.map((page) => ({
      id: page.id,
      name: page.name,
      description: page.description,
      sections: page.sections.map((section) => ({
        id: section.id,
        caption: section.caption,
        description: section.description,
        images: section.images?.map((img) => ({
          id: img.id,
          url: img.url,
          isLocalFile: img.isLocalFile,
        })),
      })),
    }));

    this.logger.debug(`Total de páginas encontradas: ${safeResult.length}`);
    return safeResult;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.debug(`Buscando página de galeria com ID=${id}...`);

    const page = await this.galleryService.findOnePage(id);

    if (!page) {
      this.logger.warn(`Página de galeria ID=${id} não encontrada.`);
      throw new BadRequestException('Página de galeria não encontrada.');
    }

    this.logger.debug(`Página de galeria encontrada: ID=${page.id}, Nome="${page.name}"`);
    return page;
  }

  @Delete(':id')
  async removePage(@Param('id', ParseIntPipe) id: string) {
    this.logger.debug(`Removendo página de galeria com ID=${id}...`);
    await this.galleryService.removePage(id);
    this.logger.debug(`Página de galeria ID=${id} removida com sucesso.`);
    return { message: 'Página de galeria removida com sucesso' };
  }
}
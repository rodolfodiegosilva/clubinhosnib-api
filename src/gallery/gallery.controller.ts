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
import { CreateGalleryPageDTO } from './dto/create-gallery.dto';

@Controller('gallery')
export class GalleryController {
  private readonly logger = new Logger(GalleryController.name);

  constructor(private readonly galleryService: GalleryService) {}

  /**
   * Rota para criar uma nova página de galeria com seções e imagens.
   */
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async createGalleryPage(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('galleryData') galleryData: string, // Ajustado para 'galleryData'
  ) {
    try {
      this.logger.debug('=== Recebendo requisição para criar uma página de galeria ===');
  
      // Verifica se os dados foram enviados
      if (!galleryData) {
        this.logger.error('galleryData não foi enviado corretamente.');
        throw new BadRequestException('galleryData é obrigatório.');
      }
  
      this.logger.debug(`Raw galleryData recebido: ${galleryData}`);
      this.logger.debug(`Arquivos recebidos: ${files.length}`);
  
      // Faz o parse dos dados recebidos
      let parsedData;
      try {
        parsedData = JSON.parse(galleryData);
      } catch (error) {
        this.logger.error('Erro ao fazer parse de galleryData:', error);
        throw new BadRequestException('galleryData inválido.');
      }
  
      const { title, description, items } = parsedData;
  
      // Valida se items é um array
      if (!Array.isArray(items)) {
        this.logger.error('items deveria ser um array.');
        throw new BadRequestException('items deve ser um array.');
      }
  
      this.logger.debug(`Total de seções recebidas: ${items.length}`);
  
      // Monta um dicionário com os arquivos recebidos
      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => {
        filesDict[file.fieldname] = file;
      });
  
      this.logger.debug(`Arquivos mapeados: ${Object.keys(filesDict)}`);
  
      // Adapta os dados para o formato esperado pelo serviço
      // O serviço espera 'name' e 'sections', mas o frontend envia 'title' e 'items'
      const adaptedData = {
        name: title, // Mapeia 'title' para 'name'
        description,
        sections: items, // Mapeia 'items' para 'sections'
      };
  
      // Chama o serviço para criar a página
      const savedPage = await this.galleryService.createGalleryPage(
        adaptedData,
        filesDict,
      );
  
      this.logger.debug(`Página de galeria criada: ID=${savedPage.id}, Nome="${savedPage.name}"`);
  
      // Retorna uma resposta limpa
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

  /**
   * Rota para buscar todas as páginas de galeria.
   */
  @Get()
  async findAll() {
    this.logger.debug('Buscando todas as páginas de galeria...');

    const pages = await this.galleryService.findAllPages();

    // Formata a resposta
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
    return page; // Retorna diretamente sem formatar
  }
  

  /**
   * Rota para excluir uma página de galeria específica pelo ID.
   */
  @Delete(':id')
  async removePage(@Param('id', ParseIntPipe) id: string) {
    this.logger.debug(`Removendo página de galeria com ID=${id}...`);
    await this.galleryService.removePage(id);
    this.logger.debug(`Página de galeria ID=${id} removida com sucesso.`);
    return { message: 'Página de galeria removida com sucesso' };
  }
}
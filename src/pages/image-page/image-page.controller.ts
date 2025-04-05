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
import { ImageService } from './image-page.service';
import { ImagePageResponseDto } from './dto/image-page-response.dto';
import { CreateImagePageDto } from './dto/create-image.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { UpdateImagePageDto } from './dto/update-image.dto';

@Controller('image-pages')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

  constructor(
    private readonly galleryService: ImageService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async createImagePage(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('imageData') raw: string,
  ): Promise<ImagePageResponseDto> {
    this.logger.debug('🚀 Recebendo requisição para criar uma nova galeria');

    try {
      const parsedData = JSON.parse(raw);
      const dto = plainToInstance(CreateImagePageDto, parsedData);

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

      const result = await this.galleryService.createImagePage(dto, filesDict);
      this.logger.log(`✅ Galeria criada com sucesso: ID=${result.id}`);

      return result;
    } catch (error) {
      this.logger.error('Erro ao criar galeria', error);
      throw new BadRequestException('Erro ao criar a galeria.');
    }
  }



  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async updateImagePage(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[], // Recebendo os arquivos enviados
    @Body('imageData') raw: string, // Dados da imagem em formato JSON
  ): Promise<ImagePageResponseDto> {
    this.logger.debug('🚀 Recebendo requisição para atualizar galeria com ID:', id);
  
    // Imprimindo os arquivos recebidos
    this.logger.debug('🔍 Arquivos recebidos:', files);
  
    try {
      // Fazendo o parse dos dados recebidos
      const parsedDto = plainToInstance(UpdateImagePageDto, JSON.parse(raw));
  
      // Validando os dados recebidos
      const errors = await validate(parsedDto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
  
      if (errors.length > 0) {
        this.logger.warn('❌ Validação falhou ao atualizar galeria:', errors);
        throw new BadRequestException('Dados inválidos na requisição');
      }
  
      // Criando um dicionário de arquivos, similar ao POST
      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));
  
      // Chamando o serviço de atualização da galeria, passando os dados validados e o dicionário de arquivos
      return await this.galleryService.updateImagePage(id, parsedDto, filesDict);
    } catch (err) {
      this.logger.error('❌ Erro ao atualizar galeria', err);
      throw new BadRequestException('Erro ao atualizar a galeria.');
    }
  }
  
  

  @Get()
  async findAll(): Promise<ImagePageResponseDto[]> {
    return this.galleryService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ImagePageResponseDto> {
    try {
      return await this.galleryService.findOne(id);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new BadRequestException('Erro ao buscar galeria.');
    }
  }

  @Delete(':id')
  async removePage(@Param('id') id: string) {
    await this.galleryService.removePage(id);
    return { message: 'Página de galeria removida com sucesso' };
  }

  private toFileDict(files: Express.Multer.File[]): Record<string, Express.Multer.File> {
    return files.reduce((acc, file) => {
      acc[file.fieldname] = file;
      return acc;
    }, {} as Record<string, Express.Multer.File>);
  }
}

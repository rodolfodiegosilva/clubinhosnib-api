import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Body,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WeekMaterialsPageResponseDTO } from './dto/week-material-response.dto';
import { WeekMaterialsPageCreateService } from './services/WeekMaterialsPageCreateService';
import { WeekMaterialsPageUpdateService } from './services/WeekMaterialsPageUpdateService';
import { WeekMaterialsPageGetService } from './services/WeekMaterialsPageGetService';
import { UpdateWeekMaterialsPageDto } from './dto/update-week-material.dto';
import { WeekMaterialsPageRemoveService } from './services/WeekMaterialsPageRemoveService';
import { CreateWeekMaterialsPageDto } from './dto/create-week-material.dto';

@Controller('week-material-pages')
export class WeekMaterialsPageController {
  private readonly logger = new Logger(WeekMaterialsPageController.name);

  constructor(
    private readonly createService: WeekMaterialsPageCreateService,
    private readonly updateService: WeekMaterialsPageUpdateService,
    private readonly removeService: WeekMaterialsPageRemoveService,
    private readonly getService: WeekMaterialsPageGetService,
  ) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('weekMaterialsPageData') raw: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug('🚀 Recebendo requisição para criar página de materiais');

    try {
      if (!raw) {
        throw new BadRequestException('weekMaterialsPageData é obrigatório.');
      }

      // Parsear o JSON manualmente
      const parsedData = JSON.parse(raw);

      // Validar e transformar em DTO usando ValidationPipe manualmente
      const validationPipe = new ValidationPipe({ transform: true });
      const dto: CreateWeekMaterialsPageDto = await validationPipe.transform(parsedData, {
        type: 'body',
        metatype: CreateWeekMaterialsPageDto,
      });

      // Criar o dicionário de arquivos
      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => {
        this.logger.debug(`Arquivo recebido - fieldname: ${file.fieldname}`);
        filesDict[file.fieldname] = file;
      });
      this.logger.debug(`Chaves em filesDict: ${Object.keys(filesDict)}`);

      // Chamar o serviço com o DTO validado
      return await this.createService.createWeekMaterialsPage(dto, filesDict);
    } catch (error) {
      this.logger.error('Erro ao criar página de materiais', error);
      throw new BadRequestException('Erro ao criar a página de materiais: ' + error.message);
    }
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('weekMaterialsPageData') raw: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug('🚀 Recebendo requisição para atualizar página de materiais com ID:', id);

    try {
      if (!raw) throw new BadRequestException('weekMaterialsPageData é obrigatório.');
      const parsedData = JSON.parse(raw);
      const dto = plainToInstance(UpdateWeekMaterialsPageDto, parsedData);
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
      const result = await this.updateService.updateWeekMaterialsPage(id, dto, filesDict);
      this.logger.log(`✅ Página de materiais atualizada com sucesso: ID=${result.id}`);
      return WeekMaterialsPageResponseDTO.fromEntity(result);
    } catch (error) {
      this.logger.error('Erro ao atualizar página de materiais', error);
      throw new BadRequestException('Erro ao atualizar a página de materiais.');
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.debug('🚀 Recebendo requisição para remover página de materiais com ID:', id);
    try {
      await this.removeService.removeWeekMaterial(id);
      this.logger.log(`✅ Página removida com sucesso: ID=${id}`);
    } catch (error) {
      this.logger.error('Erro ao remover página de materiais', error);
      throw new BadRequestException('Erro ao remover a página de materiais.');
    }
  }

  @Get()
  async findAll(): Promise<WeekMaterialsPageResponseDTO[]> {
    this.logger.debug('📥 Recebendo requisição para buscar todas as páginas');
    return this.getService.findAllPagesWithMedia();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug('📄 Recebendo requisição para buscar página com ID:', id);
    return this.getService.findPageWithMedia(id);
  }
}
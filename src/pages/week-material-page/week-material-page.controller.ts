import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFiles,
  UseInterceptors,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { WeekMaterialsPageService } from './week-material-page.service';
import { WeekMaterialsPageResponseDTO } from './dto/week-material-response.dto';

@Controller('week-material-pages')
export class WeekMaterialsPageController {
  private readonly logger = new Logger(WeekMaterialsPageController.name);

  constructor(private readonly weekService: WeekMaterialsPageService) { }

  @Get()
  async findAll(): Promise<WeekMaterialsPageResponseDTO[]> {
    this.logger.debug('📄 Listando todas as páginas com mídias...');
    return await this.weekService.findAllPagesWithMedia();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`🔍 Buscando página da semana ID=${id}`);
    return this.weekService.findPageWithMedia(id);
  }

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('weekMaterialsPageData') weekMaterialsPageData: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`📥 Recebida requisição para criar página de materiais de estudo`);

    if (!weekMaterialsPageData) {
      throw new BadRequestException('weekMaterialsPageData é obrigatório.');
    }

    try {
      const dto = JSON.parse(weekMaterialsPageData);

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => {
        this.logger.debug(`📁 Processando arquivo: fieldname=${file.fieldname}, originalName=${file.originalname}`);
        filesDict[file.fieldname] = file;
      });

      const page = await this.weekService.createWeekMaterialsPage(dto, filesDict);

      this.logger.debug(`✅ Página criada com sucesso no service. ID=${page.id}`);
      return WeekMaterialsPageResponseDTO.fromEntity(page);
    } catch (error) {
      this.logger.error('❌ Erro ao criar página de materiais:', error);
      throw new BadRequestException('Erro ao criar página de materiais de estudo.');
    }
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('weekMaterialsPageData') weekMaterialsPageData: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`🛠️ Atualizando página da semana ID=${id}`);

    if (!weekMaterialsPageData) {
      throw new BadRequestException('weekMaterialsPageData é obrigatório.');
    }

    try {
      const dto = JSON.parse(weekMaterialsPageData);

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => {
        filesDict[file.fieldname] = file;
      });

      const updated = await this.weekService.updateWeekMaterialsPage(id, dto, filesDict);
      return WeekMaterialsPageResponseDTO.fromEntity(updated);
    } catch (error) {
      this.logger.error(`❌ Erro ao atualizar página ID=${id}`, error);
      throw new BadRequestException('Erro ao atualizar página de materiais de estudo.');
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ deleted: boolean }> {
    this.logger.debug(`🗑️ Removendo página de materiais ID=${id}`);
    await this.weekService.removeWeekMaterial(id);
    return { deleted: true };
  }
}

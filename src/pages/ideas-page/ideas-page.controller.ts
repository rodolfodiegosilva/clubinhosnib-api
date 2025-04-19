import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Logger,
  ValidationPipe,
  Get,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { CreateIdeasPageDto } from './dto/create-ideas-page.dto';
import { IdeasPageResponseDto } from './dto/ideas-page-response.dto';
import { IdeasPageCreateService } from './services/ideas-page-create.service';
import { IdeasPageRemoveService } from './services/ideas-page-remove.service';
import { IdeasPageGetService } from './services/ideas-page-get.service';

@Controller('ideas-pages')
export class IdeasPageController {
  private readonly logger = new Logger(IdeasPageController.name);

  constructor(
    private readonly ideasPageCreateService: IdeasPageCreateService,
    private readonly ideasPageRemoveService: IdeasPageRemoveService,
    private readonly ideasPageGetService: IdeasPageGetService,
  ) { }

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Body('ideasMaterialsPageData') raw: string,
  ): Promise<IdeasPageResponseDto> {
    this.logger.debug('🚀 Recebendo requisição para criar página de ideias');

    try {
      if (!raw) {
        throw new BadRequestException('ideasMaterialsPageData é obrigatório.');
      }

      const parsed = JSON.parse(raw);
      const validationPipe = new ValidationPipe({ transform: true });
      const dto: CreateIdeasPageDto = await validationPipe.transform(parsed, {
        type: 'body',
        metatype: CreateIdeasPageDto,
      });

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((f) => {
        this.logger.debug(`Arquivo recebido - fieldname: ${f.fieldname}`);
        filesDict[f.fieldname] = f;
      });

      return await this.ideasPageCreateService.createIdeasPage(dto, filesDict);
    } catch (err) {
      this.logger.error('Erro ao criar página de ideias', err);
      throw new BadRequestException(
        'Erro ao criar página de ideias: ' + err.message,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.debug(
      `🚀 Recebendo requisição para remover página de ideias ID=${id}`,
    );
    try {
      await this.ideasPageRemoveService.removeIdeasPage(id);
      this.logger.log(`✅ Página de ideias removida com sucesso: ID=${id}`);
    } catch (error) {
      this.logger.error('Erro ao remover página de ideias', error);
      throw new BadRequestException(
        'Erro ao remover a página de ideias: ' + error.message,
      );
    }
  }

  @Get()
  async findAll(): Promise<IdeasPageResponseDto[]> {
    this.logger.debug('📥 GET /ideas-pages');
    return this.ideasPageGetService.findAllPagesWithMedia();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<IdeasPageResponseDto> {
    this.logger.debug(`📄 GET /ideas-pages/${id}`);
    return this.ideasPageGetService.findPageWithMedia(id);
  }
}

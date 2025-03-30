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
  import { StudyMaterialsPageService } from './study-material-page.service';
  import { StudyMaterialsPageResponseDTO } from './dto/study-material-response.dto';
  
  @Controller('study-materials-page')
  export class StudyMaterialsPageController {
    private readonly logger = new Logger(StudyMaterialsPageController.name);
  
    constructor(private readonly studyService: StudyMaterialsPageService) {}
  
    @Get()
    async findAll(): Promise<StudyMaterialsPageResponseDTO[]> {
      this.logger.debug('📄 Listando todas as páginas de materiais de estudo...');
      const pages = await this.studyService.findAllPages();
      return pages.map(StudyMaterialsPageResponseDTO.fromEntity);
    }
  
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<StudyMaterialsPageResponseDTO> {
      this.logger.debug(`🔍 Buscando página de materiais ID=${id}`);
      const page = await this.studyService.findOnePage(id);
      return StudyMaterialsPageResponseDTO.fromEntity(page);
    }
  
    @Post()
    @UseInterceptors(AnyFilesInterceptor())
    async create(
      @UploadedFiles() files: Express.Multer.File[],
      @Body('studyMaterialsPageData') studyMaterialsPageData: string,
    ): Promise<StudyMaterialsPageResponseDTO> {
      this.logger.debug(`📥 Criando nova página de materiais de estudo...`);
  
      if (!studyMaterialsPageData) {
        throw new BadRequestException('studyMaterialsPageData é obrigatório.');
      }
  
      try {
        const dto = JSON.parse(studyMaterialsPageData);
  
        const filesDict: Record<string, Express.Multer.File> = {};
        files.forEach((file) => {
          filesDict[file.fieldname] = file;
        });
  
        const page = await this.studyService.createStudyMaterialsPage(dto, filesDict);
        return StudyMaterialsPageResponseDTO.fromEntity(page);
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
      @Body('studyMaterialsPageData') studyMaterialsPageData: string,
    ): Promise<StudyMaterialsPageResponseDTO> {
      this.logger.debug(`🛠️ Atualizando página de materiais de estudo ID=${id}`);
  
      if (!studyMaterialsPageData) {
        throw new BadRequestException('studyMaterialsPageData é obrigatório.');
      }
  
      try {
        const dto = JSON.parse(studyMaterialsPageData);
  
        const filesDict: Record<string, Express.Multer.File> = {};
        files.forEach((file) => {
          filesDict[file.fieldname] = file;
        });
  
        const updated = await this.studyService.updateStudyMaterialsPage(id, dto, filesDict);
        return StudyMaterialsPageResponseDTO.fromEntity(updated);
      } catch (error) {
        this.logger.error(`❌ Erro ao atualizar página ID=${id}`, error);
        throw new BadRequestException('Erro ao atualizar página de materiais de estudo.');
      }
    }
  
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<{ deleted: boolean }> {
      this.logger.debug(`🗑️ Removendo página de materiais ID=${id}`);
      await this.studyService.removePage(id);
      return { deleted: true };
    }
  }
  
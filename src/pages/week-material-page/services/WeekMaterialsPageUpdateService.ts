import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
  } from '@nestjs/common';
  import { DataSource, QueryRunner } from 'typeorm';
  import { AwsS3Service } from 'src/aws/aws-s3.service';
  import { RouteService } from 'src/route/route.service';
  import { RouteEntity } from 'src/route/route-page.entity';
  import { MediaTargetType } from 'src/share/media/media-target-type.enum';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { MediaItemEntity, MediaType } from 'src/share/media/media-item/media-item.entity';
  import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
  
  @Injectable()
  export class WeekMaterialsPageUpdateService {
    private readonly logger = new Logger(WeekMaterialsPageUpdateService.name);
  
    constructor(
      private readonly dataSource: DataSource,
      private readonly s3: AwsS3Service,
      private readonly routeService: RouteService,
      private readonly mediaItemProcessor: MediaItemProcessor,
    ) {
      this.logger.debug('🛠️ WeekMaterialsPageUpdateService inicializado');
    }
  
    async updateWeekMaterialsPage(
      id: string,
      dto: any,
      filesDict: Record<string, Express.Multer.File>,
    ): Promise<WeekMaterialsPageEntity> {
      this.logger.debug(`🚀 Iniciando atualização da página ID=${id}`);
      const queryRunner = this.dataSource.createQueryRunner();
      this.logger.debug('🔗 Conectando ao QueryRunner');
      await queryRunner.connect();
      this.logger.debug('🔄 Iniciando transação');
      await queryRunner.startTransaction();
  
      try {
        const page = await this.validatePage(id, queryRunner);
        const route = await this.validateRoute(page.id, queryRunner);
        const existingVideos = await this.validateVideoMedia(page.id, queryRunner);
        const existingDocuments = await this.validateDocumentMedia(page.id, queryRunner);
        const existingImages = await this.validateImageMedia(page.id, queryRunner);
        const existingAudios = await this.validateAudioMedia(page.id, queryRunner);
  
        const { pageTitle, pageSubtitle, pageDescription, videos, documents, images, audios } = dto;
        this.logger.debug(`📋 Dados extraídos: title="${pageTitle}", subtitle="${pageSubtitle}", vídeos=${videos?.length || 0}, documentos=${documents?.length || 0}, imagens=${images?.length || 0}, áudios=${audios?.length || 0}`);
  
        await this.deleteVideoMedia(existingVideos, videos, queryRunner);
        await this.deleteDocumentMedia(existingDocuments, documents, queryRunner);
        await this.deleteImageMedia(existingImages, images, queryRunner);
        await this.deleteAudioMedia(existingAudios, audios, queryRunner);
  
        for (const video of videos || []) {
          if (video.id) {
            await this.upsertVideoMedia(video, page.id, filesDict, queryRunner);
          } else {
            await this.addVideoMedia(video, page.id, filesDict, queryRunner);
          }
        }
        for (const document of documents || []) {
          if (document.id) {
            await this.upsertDocumentMedia(document, page.id, filesDict, queryRunner);
          } else {
            await this.addDocumentMedia(document, page.id, filesDict, queryRunner);
          }
        }
        for (const image of images || []) {
          if (image.id) {
            await this.upsertImageMedia(image, page.id, filesDict, queryRunner);
          } else {
            await this.addImageMedia(image, page.id, filesDict, queryRunner);
          }
        }
        for (const audio of audios || []) {
          if (audio.id) {
            await this.upsertAudioMedia(audio, page.id, filesDict, queryRunner);
          } else {
            await this.addAudioMedia(audio, page.id, filesDict, queryRunner);
          }
        }
  
        const routeData: Partial<RouteEntity> = { title: pageTitle, subtitle: pageSubtitle, description: pageDescription };
        await this.routeService.upsertRoute(route.id, routeData);
  
        page.title = pageTitle;
        page.subtitle = pageSubtitle;
        page.description = pageDescription;
        const updatedPage = await queryRunner.manager.save(WeekMaterialsPageEntity, page);
  
        await queryRunner.commitTransaction();
        this.logger.debug(`✅ Página atualizada com sucesso. ID=${updatedPage.id}`);
        return updatedPage;
      } catch (error) {
        this.logger.error('❌ Erro ao atualizar página', error.stack);
        await queryRunner.rollbackTransaction();
        throw new BadRequestException('Erro ao atualizar a página de materiais.');
      } finally {
        await queryRunner.release();
      }
    }
  
    // Métodos de Validação (mantidos sem alterações)
    private async validatePage(id: string, queryRunner: QueryRunner): Promise<WeekMaterialsPageEntity> {
      this.logger.debug(`🔍 Buscando página ID=${id}`);
      const page = await queryRunner.manager.findOne(WeekMaterialsPageEntity, {
        where: { id },
        relations: ['route'],
      });
      if (!page) {
        this.logger.warn(`⚠️ Página ID=${id} não encontrada`);
        throw new NotFoundException('Página não encontrada');
      }
      this.logger.debug(`✅ Página ID=${id} encontrada`);
      return page;
    }
  
    private async validateRoute(entityId: string, queryRunner: QueryRunner): Promise<RouteEntity> {
      this.logger.debug(`🔍 Buscando rota para entityId=${entityId}`);
      const route = await this.routeService.findRouteByEntityId(entityId);
      if (!route) {
        this.logger.warn(`⚠️ Rota para entityId=${entityId} não encontrada`);
        throw new NotFoundException('Rota não encontrada');
      }
      this.logger.debug(`✅ Rota ID=${route.id} encontrada`);
      return route;
    }
  
    private async validateVideoMedia(pageId: string, queryRunner: QueryRunner): Promise<MediaItemEntity[]> {
      this.logger.debug(`🔍 Buscando vídeos para página ID=${pageId}`);
      const items = await this.mediaItemProcessor.findMediaItemsByTarget(pageId, MediaTargetType.WeekMaterialsPage);
      const videos = items.filter(item => item.mediaType === MediaType.VIDEO);
      this.logger.debug(`✅ Encontrados ${videos.length} vídeos`);
      return videos;
    }
  
    private async validateDocumentMedia(pageId: string, queryRunner: QueryRunner): Promise<MediaItemEntity[]> {
      this.logger.debug(`🔍 Buscando documentos para página ID=${pageId}`);
      const items = await this.mediaItemProcessor.findMediaItemsByTarget(pageId, MediaTargetType.WeekMaterialsPage);
      const documents = items.filter(item => item.mediaType === MediaType.DOCUMENT);
      this.logger.debug(`✅ Encontrados ${documents.length} documentos`);
      return documents;
    }
  
    private async validateImageMedia(pageId: string, queryRunner: QueryRunner): Promise<MediaItemEntity[]> {
      this.logger.debug(`🔍 Buscando imagens para página ID=${pageId}`);
      const items = await this.mediaItemProcessor.findMediaItemsByTarget(pageId, MediaTargetType.WeekMaterialsPage);
      const images = items.filter(item => item.mediaType === MediaType.IMAGE);
      this.logger.debug(`✅ Encontradas ${images.length} imagens`);
      return images;
    }
  
    private async validateAudioMedia(pageId: string, queryRunner: QueryRunner): Promise<MediaItemEntity[]> {
      this.logger.debug(`🔍 Buscando áudios para página ID=${pageId}`);
      const items = await this.mediaItemProcessor.findMediaItemsByTarget(pageId, MediaTargetType.WeekMaterialsPage);
      const audios = items.filter(item => item.mediaType === MediaType.AUDIO);
      this.logger.debug(`✅ Encontrados ${audios.length} áudios`);
      return audios;
    }
  
    // Métodos de Exclusão (mantidos sem alterações)
    private async deleteVideoMedia(
      existingVideos: MediaItemEntity[],
      incomingVideos: any[],
      queryRunner: QueryRunner,
    ): Promise<void> {
      this.logger.debug(`🗑️ Verificando vídeos para exclusão. Existentes: ${existingVideos.length}, Recebidos: ${incomingVideos?.length || 0}`);
      const incomingIds = new Set((incomingVideos || []).map((v) => v.id).filter(Boolean));
      const videosToRemove = existingVideos.filter((video) => !incomingIds.has(video.id));
      if (videosToRemove.length > 0) {
        this.logger.debug(`🗑️ Removendo ${videosToRemove.length} vídeos`);
        await this.mediaItemProcessor.deleteMediaItems(videosToRemove, this.s3.delete.bind(this.s3));
        this.logger.debug(`✅ ${videosToRemove.length} vídeos removidos`);
      } else {
        this.logger.debug('ℹ️ Nenhum vídeo para remover');
      }
    }
  
    private async deleteDocumentMedia(
      existingDocuments: MediaItemEntity[],
      incomingDocuments: any[],
      queryRunner: QueryRunner,
    ): Promise<void> {
      this.logger.debug(`🗑️ Verificando documentos para exclusão. Existentes: ${existingDocuments.length}, Recebidos: ${incomingDocuments?.length || 0}`);
      const incomingIds = new Set((incomingDocuments || []).map((d) => d.id).filter(Boolean));
      const documentsToRemove = existingDocuments.filter((doc) => !incomingIds.has(doc.id));
      if (documentsToRemove.length > 0) {
        this.logger.debug(`🗑️ Removendo ${documentsToRemove.length} documentos`);
        await this.mediaItemProcessor.deleteMediaItems(documentsToRemove, this.s3.delete.bind(this.s3));
        this.logger.debug(`✅ ${documentsToRemove.length} documentos removidos`);
      } else {
        this.logger.debug('ℹ️ Nenhum documento para remover');
      }
    }
  
    private async deleteImageMedia(
      existingImages: MediaItemEntity[],
      incomingImages: any[],
      queryRunner: QueryRunner,
    ): Promise<void> {
      this.logger.debug(`🗑️ Verificando imagens para exclusão. Existentes: ${existingImages.length}, Recebidas: ${incomingImages?.length || 0}`);
      const incomingIds = new Set((incomingImages || []).map((i) => i.id).filter(Boolean));
      const imagesToRemove = existingImages.filter((img) => !incomingIds.has(img.id));
      if (imagesToRemove.length > 0) {
        this.logger.debug(`🗑️ Removendo ${imagesToRemove.length} imagens`);
        await this.mediaItemProcessor.deleteMediaItems(imagesToRemove, this.s3.delete.bind(this.s3));
        this.logger.debug(`✅ ${imagesToRemove.length} imagens removidas`);
      } else {
        this.logger.debug('ℹ️ Nenhuma imagem para remover');
      }
    }
  
    private async deleteAudioMedia(
      existingAudios: MediaItemEntity[],
      incomingAudios: any[],
      queryRunner: QueryRunner,
    ): Promise<void> {
      this.logger.debug(`🗑️ Verificando áudios para exclusão. Existentes: ${existingAudios.length}, Recebidos: ${incomingAudios?.length || 0}`);
      const incomingIds = new Set((incomingAudios || []).map((a) => a.id).filter(Boolean));
      const audiosToRemove = existingAudios.filter((audio) => !incomingIds.has(audio.id));
      if (audiosToRemove.length > 0) {
        this.logger.debug(`🗑️ Removendo ${audiosToRemove.length} áudios`);
        await this.mediaItemProcessor.deleteMediaItems(audiosToRemove, this.s3.delete.bind(this.s3));
        this.logger.debug(`✅ ${audiosToRemove.length} áudios removidos`);
      } else {
        this.logger.debug('ℹ️ Nenhum áudio para remover');
      }
    }
  
    // Métodos de Adição (corrigidos para usar fieldKey)
    private async addVideoMedia(
      videoInput: any,
      pageId: string,
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity> {
      this.logger.debug(`🆕 Construindo novo vídeo: "${videoInput.title}"`);
      const media = this.mediaItemProcessor.buildBaseMediaItem(
        { ...videoInput, mediaType: MediaType.VIDEO },
        pageId,
        MediaTargetType.WeekMaterialsPage,
      );
      if (videoInput.type === 'upload' && videoInput.isLocalFile) {
        const file = filesDict[videoInput.fieldKey];
        if (!file) {
          this.logger.error(`❌ Arquivo ausente para vídeo "${videoInput.title}" (fieldKey: ${videoInput.fieldKey})`);
          throw new BadRequestException(`Arquivo ausente para vídeo "${videoInput.title}"`);
        }
        this.logger.debug(`⬆️ Fazendo upload do vídeo "${file.originalname}" para S3`);
        media.url = await this.s3.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
        this.logger.debug(`✅ Upload concluído. URL=${media.url}`);
      } else {
        media.url = videoInput.url?.trim() || '';
        media.isLocalFile = false;
        this.logger.debug(`🔗 Usando URL externa para vídeo: "${media.url}"`);
      }
      this.logger.debug(`💾 Salvando vídeo no banco`);
      const savedMedia = await this.mediaItemProcessor.saveMediaItem(media);
      this.logger.debug(`✅ Vídeo salvo com ID=${savedMedia.id}`);
      return savedMedia;
    }
  
    private async addDocumentMedia(
      documentInput: any,
      pageId: string,
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity> {
      this.logger.debug(`🆕 Construindo novo documento: "${documentInput.title}"`);
      const media = this.mediaItemProcessor.buildBaseMediaItem(
        { ...documentInput, mediaType: MediaType.DOCUMENT },
        pageId,
        MediaTargetType.WeekMaterialsPage,
      );
      if (documentInput.type === 'upload' && documentInput.isLocalFile) {
        const file = filesDict[documentInput.fieldKey];
        if (!file) {
          this.logger.error(`❌ Arquivo ausente para documento "${documentInput.title}" (fieldKey: ${documentInput.fieldKey})`);
          throw new BadRequestException(`Arquivo ausente para documento "${documentInput.title}"`);
        }
        this.logger.debug(`⬆️ Fazendo upload do documento "${file.originalname}" para S3`);
        media.url = await this.s3.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
        this.logger.debug(`✅ Upload concluído. URL=${media.url}`);
      } else {
        media.url = documentInput.url?.trim() || '';
        media.isLocalFile = false;
        this.logger.debug(`🔗 Usando URL externa para documento: "${media.url}"`);
      }
      this.logger.debug(`💾 Salvando documento no banco`);
      const savedMedia = await this.mediaItemProcessor.saveMediaItem(media);
      this.logger.debug(`✅ Documento salvo com ID=${savedMedia.id}`);
      return savedMedia;
    }
  
    private async addImageMedia(
      imageInput: any,
      pageId: string,
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity> {
      this.logger.debug(`🆕 Construindo nova imagem: "${imageInput.title}"`);
      const media = this.mediaItemProcessor.buildBaseMediaItem(
        { ...imageInput, mediaType: MediaType.IMAGE },
        pageId,
        MediaTargetType.WeekMaterialsPage,
      );
      if (imageInput.type === 'upload' && imageInput.isLocalFile) {
        const file = filesDict[imageInput.fieldKey];
        if (!file) {
          this.logger.error(`❌ Arquivo ausente para imagem "${imageInput.title}" (fieldKey: ${imageInput.fieldKey})`);
          throw new BadRequestException(`Arquivo ausente para imagem "${imageInput.title}"`);
        }
        this.logger.debug(`⬆️ Fazendo upload da imagem "${file.originalname}" para S3`);
        media.url = await this.s3.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
        this.logger.debug(`✅ Upload concluído. URL=${media.url}`);
      } else {
        media.url = imageInput.url?.trim() || '';
        media.isLocalFile = false;
        this.logger.debug(`🔗 Usando URL externa para imagem: "${media.url}"`);
      }
      this.logger.debug(`💾 Salvando imagem no banco`);
      const savedMedia = await this.mediaItemProcessor.saveMediaItem(media);
      this.logger.debug(`✅ Imagem salva com ID=${savedMedia.id}`);
      return savedMedia;
    }
  
    private async addAudioMedia(
      audioInput: any,
      pageId: string,
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity> {
      this.logger.debug(`🆕 Construindo novo áudio: "${audioInput.title}"`);
      const media = this.mediaItemProcessor.buildBaseMediaItem(
        { ...audioInput, mediaType: MediaType.AUDIO },
        pageId,
        MediaTargetType.WeekMaterialsPage,
      );
      if (audioInput.type === 'upload' && audioInput.isLocalFile) {
        const file = filesDict[audioInput.fieldKey];
        if (!file) {
          this.logger.error(`❌ Arquivo ausente para áudio "${audioInput.title}" (fieldKey: ${audioInput.fieldKey})`);
          throw new BadRequestException(`Arquivo ausente para áudio "${audioInput.title}"`);
        }
        this.logger.debug(`⬆️ Fazendo upload do áudio "${file.originalname}" para S3`);
        media.url = await this.s3.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
        this.logger.debug(`✅ Upload concluído. URL=${media.url}`);
      } else {
        media.url = audioInput.url?.trim() || '';
        media.isLocalFile = false;
        this.logger.debug(`🔗 Usando URL externa para áudio: "${media.url}"`);
      }
      this.logger.debug(`💾 Salvando áudio no banco`);
      const savedMedia = await this.mediaItemProcessor.saveMediaItem(media);
      this.logger.debug(`✅ Áudio salvo com ID=${savedMedia.id}`);
      return savedMedia;
    }
  
    // Métodos de Upsert (corrigidos para usar fieldKey)
    private async upsertVideoMedia(
      videoInput: any,
      pageId: string,
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity> {
      this.logger.debug(`✏️ Construindo atualização de vídeo ID=${videoInput.id}`);
      const media = this.mediaItemProcessor.buildBaseMediaItem(
        { ...videoInput, mediaType: MediaType.VIDEO },
        pageId,
        MediaTargetType.WeekMaterialsPage,
      );
      if (videoInput.type === 'upload' && videoInput.isLocalFile && videoInput.fieldKey) {
        this.logger.debug(`🔍 Verificando vídeo existente ID=${videoInput.id}`);
        const existing = await queryRunner.manager.findOne(MediaItemEntity, {
          where: { id: videoInput.id },
        });
        if (existing && existing.isLocalFile) {
          this.logger.debug(`🗑️ Removendo arquivo existente do S3: ${existing.url}`);
          await this.s3.delete(existing.url);
        }
        const file = filesDict[videoInput.fieldKey];
        if (!file) {
          this.logger.error(`❌ Arquivo ausente para vídeo "${videoInput.title}" (fieldKey: ${videoInput.fieldKey})`);
          throw new BadRequestException(`Arquivo ausente para vídeo "${videoInput.title}"`);
        }
        this.logger.debug(`⬆️ Fazendo upload do novo vídeo "${file.originalname}" para S3`);
        media.url = await this.s3.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
        this.logger.debug(`✅ Upload concluído. URL=${media.url}`);
      } else {
        media.url = videoInput.url?.trim() || '';
        media.isLocalFile = false;
        this.logger.debug(`🔗 Usando URL externa para vídeo: "${media.url}"`);
      }
      this.logger.debug(`💾 Atualizando vídeo no banco`);
      const updatedMedia = await this.mediaItemProcessor.upsertMediaItem(videoInput.id, media);
      this.logger.debug(`✅ Vídeo atualizado com ID=${updatedMedia.id}`);
      return updatedMedia;
    }
  
    private async upsertDocumentMedia(
      documentInput: any,
      pageId: string,
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity> {
      this.logger.debug(`✏️ Construindo atualização de documento ID=${documentInput.id}`);
      const media = this.mediaItemProcessor.buildBaseMediaItem(
        { ...documentInput, mediaType: MediaType.DOCUMENT },
        pageId,
        MediaTargetType.WeekMaterialsPage,
      );
      if (documentInput.type === 'upload' && documentInput.isLocalFile && documentInput.fieldKey) {
        this.logger.debug(`🔍 Verificando documento existente ID=${documentInput.id}`);
        const existing = await queryRunner.manager.findOne(MediaItemEntity, {
          where: { id: documentInput.id },
        });
        if (existing && existing.isLocalFile) {
          this.logger.debug(`🗑️ Removendo arquivo existente do S3: ${existing.url}`);
          await this.s3.delete(existing.url);
        }
        const file = filesDict[documentInput.fieldKey];
        if (!file) {
          this.logger.error(`❌ Arquivo ausente para documento "${documentInput.title}" (fieldKey: ${documentInput.fieldKey})`);
          throw new BadRequestException(`Arquivo ausente para documento "${documentInput.title}"`);
        }
        this.logger.debug(`⬆️ Fazendo upload do novo documento "${file.originalname}" para S3`);
        media.url = await this.s3.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
        this.logger.debug(`✅ Upload concluído. URL=${media.url}`);
      } else {
        media.url = documentInput.url?.trim() || '';
        media.isLocalFile = false;
        this.logger.debug(`🔗 Usando URL externa para documento: "${media.url}"`);
      }
      this.logger.debug(`💾 Atualizando documento no banco`);
      const updatedMedia = await this.mediaItemProcessor.upsertMediaItem(documentInput.id, media);
      this.logger.debug(`✅ Documento atualizado com ID=${updatedMedia.id}`);
      return updatedMedia;
    }
  
    private async upsertImageMedia(
      imageInput: any,
      pageId: string,
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity> {
      this.logger.debug(`✏️ Construindo atualização de imagem ID=${imageInput.id}`);
      const media = this.mediaItemProcessor.buildBaseMediaItem(
        { ...imageInput, mediaType: MediaType.IMAGE },
        pageId,
        MediaTargetType.WeekMaterialsPage,
      );
      if (imageInput.type === 'upload' && imageInput.isLocalFile && imageInput.fieldKey) {
        this.logger.debug(`🔍 Verificando imagem existente ID=${imageInput.id}`);
        const existing = await queryRunner.manager.findOne(MediaItemEntity, {
          where: { id: imageInput.id },
        });
        if (existing && existing.isLocalFile) {
          this.logger.debug(`🗑️ Removendo arquivo existente do S3: ${existing.url}`);
          await this.s3.delete(existing.url);
        }
        const file = filesDict[imageInput.fieldKey];
        if (!file) {
          this.logger.error(`❌ Arquivo ausente para imagem "${imageInput.title}" (fieldKey: ${imageInput.fieldKey})`);
          throw new BadRequestException(`Arquivo ausente para imagem "${imageInput.title}"`);
        }
        this.logger.debug(`⬆️ Fazendo upload da nova imagem "${file.originalname}" para S3`);
        media.url = await this.s3.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
        this.logger.debug(`✅ Upload concluído. URL=${media.url}`);
      } else {
        media.url = imageInput.url?.trim() || '';
        media.isLocalFile = false;
        this.logger.debug(`🔗 Usando URL externa para imagem: "${media.url}"`);
      }
      this.logger.debug(`💾 Atualizando imagem no banco`);
      const updatedMedia = await this.mediaItemProcessor.upsertMediaItem(imageInput.id, media);
      this.logger.debug(`✅ Imagem atualizada com ID=${updatedMedia.id}`);
      return updatedMedia;
    }
  
    private async upsertAudioMedia(
      audioInput: any,
      pageId: string,
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity> {
      this.logger.debug(`✏️ Construindo atualização de áudio ID=${audioInput.id}`);
      const media = this.mediaItemProcessor.buildBaseMediaItem(
        { ...audioInput, mediaType: MediaType.AUDIO },
        pageId,
        MediaTargetType.WeekMaterialsPage,
      );
      if (audioInput.type === 'upload' && audioInput.isLocalFile && audioInput.fieldKey) {
        this.logger.debug(`🔍 Verificando áudio existente ID=${audioInput.id}`);
        const existing = await queryRunner.manager.findOne(MediaItemEntity, {
          where: { id: audioInput.id },
        });
        if (existing && existing.isLocalFile) {
          this.logger.debug(`🗑️ Removendo arquivo existente do S3: ${existing.url}`);
          await this.s3.delete(existing.url);
        }
        const file = filesDict[audioInput.fieldKey];
        if (!file) {
          this.logger.error(`❌ Arquivo ausente para áudio "${audioInput.title}" (fieldKey: ${audioInput.fieldKey})`);
          throw new BadRequestException(`Arquivo ausente para áudio "${audioInput.title}"`);
        }
        this.logger.debug(`⬆️ Fazendo upload do novo áudio "${file.originalname}" para S3`);
        media.url = await this.s3.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
        this.logger.debug(`✅ Upload concluído. URL=${media.url}`);
      } else {
        media.url = audioInput.url?.trim() || '';
        media.isLocalFile = false;
        this.logger.debug(`🔗 Usando URL externa para áudio: "${media.url}"`);
      }
      this.logger.debug(`💾 Atualizando áudio no banco`);
      const updatedMedia = await this.mediaItemProcessor.upsertMediaItem(audioInput.id, media);
      this.logger.debug(`✅ Áudio atualizado com ID=${updatedMedia.id}`);
      return updatedMedia;
    }
  }
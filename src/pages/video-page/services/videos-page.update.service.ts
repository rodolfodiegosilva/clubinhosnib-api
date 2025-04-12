import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
  } from '@nestjs/common';
  import { DataSource, QueryRunner } from 'typeorm';
  import { AwsS3Service } from 'src/aws/aws-s3.service';
  import { RouteService } from 'src/route/route.service';
  import { RouteEntity, RouteType } from 'src/route/route-page.entity';
  import {
    MediaItemEntity,
    MediaPlatform,
    MediaType,
    MediaUploadType,
  } from 'src/share/media/media-item/media-item.entity';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { VideosPage } from '../entities/video-page.entity';
  import { UpdateVideosPageDto } from '../dto/update-videos-page.dto';
  import { VideosPageResponseDto } from '../dto/videos-page-response.dto';
  import { VideosPageRepository } from '../video-page.repository';
  
  @Injectable()
  export class UpdateVideosPageService {
    private readonly logger = new Logger(UpdateVideosPageService.name);
  
    constructor(
      private readonly dataSource: DataSource,
      private readonly awsS3Service: AwsS3Service,
      private readonly routeService: RouteService,
      private readonly mediaItemProcessor: MediaItemProcessor,
      private readonly videosPageRepo: VideosPageRepository,
    ) {}
  
    async execute(
      id: string,
      dto: UpdateVideosPageDto,
      filesDict: Record<string, Express.Multer.File>,
    ): Promise<VideosPageResponseDto> {
      this.logger.log(`🚀 Iniciando atualização da página de vídeos com ID: ${id}`);
      const queryRunner = this.dataSource.createQueryRunner();
      this.logger.debug('🔗 Conectando ao QueryRunner');
      await queryRunner.connect();
      this.logger.debug('🔄 Iniciando transação');
      await queryRunner.startTransaction();
  
      try {
        this.logger.debug(`🔍 Buscando página de vídeos com ID: ${id}`);
        const existingPage = await this.videosPageRepo.findById(id);
        if (!existingPage) {
          this.logger.warn(`❌ Página não encontrada para ID: ${id}`);
          throw new NotFoundException('Página não encontrada');
        }
        this.logger.debug(`📋 Página encontrada: title=${existingPage.name}`);
  
        this.logger.debug(`🔍 Buscando mídias existentes para a página ID: ${existingPage.id}`);
        const existingMedia = await this.mediaItemProcessor.findManyMediaItemsByTargets(
          [existingPage.id],
          'VideosPage',
        );
        this.logger.debug(`📋 Encontradas ${existingMedia.length} mídias existentes`);
  
        this.logger.debug(`🗑️ Removendo mídias não mais presentes na requisição`);
        await this.deleteMedia(existingMedia, dto.videos, queryRunner);
  
        this.logger.debug(`📝 Atualizando dados da página: title=${dto.title}`);
        existingPage.name = dto.title;
        existingPage.description = dto.description;
        existingPage.public = dto.public;
        this.logger.debug(`💾 Salvando página atualizada`);
        const updatedPage = await queryRunner.manager.save(existingPage);
        this.logger.debug(`💾 Página salva com ID: ${updatedPage.id}`);
  
        this.logger.debug(`🔄 Atualizando rota para a página ID: ${updatedPage.id}`);
        const savedRoute = await this.upsertRoute(existingPage.route.id, dto, updatedPage.id);
        this.logger.debug(`🛤️ Rota atualizada com path: ${savedRoute.path}`);
  
        this.logger.debug(`📽️ Processando mídias da página`);
        const mediaItems = await this.processPageMedia(
          dto.videos,
          updatedPage.id,
          existingMedia,
          filesDict,
          queryRunner,
        );
        this.logger.debug(`✅ Processadas ${mediaItems.length} mídias`);
  
        this.logger.debug(`🔗 Associando rota à página`);
        updatedPage.route = savedRoute;
        this.logger.debug(`💾 Salvando página com rota associada`);
        const finalPage = await queryRunner.manager.save(updatedPage);
        this.logger.debug(`💾 Página final salva com ID: ${finalPage.id}`);
  
        this.logger.log(`✅ Commit da transação para página ID: ${finalPage.id}`);
        await queryRunner.commitTransaction();
        this.logger.log(`✅ Página de vídeos atualizada com sucesso: ID=${finalPage.id}`);
        return VideosPageResponseDto.fromEntity(finalPage, mediaItems);
      } catch (error) {
        this.logger.error('❌ Erro ao atualizar página de vídeos. Rollback executado.', error.stack);
        await queryRunner.rollbackTransaction();
        throw new BadRequestException('Erro ao atualizar a página de vídeos.');
      } finally {
        this.logger.debug('🔚 Liberando QueryRunner');
        await queryRunner.release();
      }
    }
  
    private async upsertRoute(
      routeId: string,
      pageData: UpdateVideosPageDto,
      videoPageId: string,
    ): Promise<RouteEntity> {
      this.logger.debug(`🔄 Iniciando upsert da rota ID: ${routeId}`);
      const routeData: Partial<RouteEntity> = {
        title: pageData.title,
        subtitle: 'Página de vídeos',
        idToFetch: videoPageId,
        entityType: 'VideosPage',
        entityId: videoPageId,
        public: pageData.public,
        type: RouteType.PAGE,
        description: pageData.description,
        path:'galeria_videos_',
        image: 'https://bucket-clubinho-galeria.s3.us-east-2.amazonaws.com/uploads/img_card.jpg',
      };
      const savedRoute = await this.routeService.upsertRoute(routeId, routeData);
      this.logger.debug(`✅ Rota upsertada: ${savedRoute.id}, path: ${savedRoute.path}`);
      return savedRoute;
    }
  
    private async deleteMedia(
      existingMedia: MediaItemEntity[],
      requestedMedia: any[],
      queryRunner: QueryRunner,
    ): Promise<void> {
      this.logger.debug(`🔍 Identificando mídias a remover`);
      const requestedMediaIds = requestedMedia.map((media) => media.id).filter(Boolean);
      const mediaToRemove = existingMedia.filter(
        (existing) => !requestedMediaIds.includes(existing.id),
      );
      this.logger.debug(`🗑️ ${mediaToRemove.length} mídias marcadas para remoção`);
  
      for (const media of mediaToRemove) {
        this.logger.debug(`🗑️ Removendo mídia ID: ${media.id}, URL: ${media.url}`);
        await this.mediaItemProcessor.removeMediaItem(media, this.awsS3Service.delete.bind(this.awsS3Service));
        this.logger.debug(`🗑️ Mídia ID: ${media.id} removida do S3 (se aplicável)`);
        await queryRunner.manager.remove(MediaItemEntity, media);
        this.logger.debug(`🗑️ Mídia ID: ${media.id} removida do banco de dados`);
      }
    }
  
    private async processPageMedia(
      mediaItems: any[],
      pageId: string,
      oldMedia: MediaItemEntity[],
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity[]> {
      this.logger.debug(`📽️ Iniciando processamento de ${mediaItems.length} mídias`);
      const processed: MediaItemEntity[] = [];
      for (const mediaInput of mediaItems) {
        this.logger.debug(`📽️ Processando mídia: type=${mediaInput.type}, id=${mediaInput.id || 'novo'}`);
        if (mediaInput.id) {
          this.logger.debug(`🔄 Mídia existente detectada, iniciando upsert`);
          const saved = await this.upsertMedia(mediaInput, pageId, filesDict, queryRunner);
          processed.push(saved);
        } else {
          this.logger.debug(`➕ Nova mídia detectada, iniciando adição`);
          const saved = await this.addMedia(mediaInput, pageId, filesDict, queryRunner);
          processed.push(saved);
        }
        this.logger.debug(`✅ Mídia processada com sucesso: ID=${processed[processed.length - 1].id}`);
      }
      this.logger.debug(`📽️ Finalizado processamento de mídias`);
      return processed;
    }
  
    private async addMedia(
      mediaInput: any,
      targetId: string,
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity> {
      this.logger.debug(`➕ Adicionando nova mídia: type=${mediaInput.type}, fieldKey=${mediaInput.fieldKey}`);
      const media = new MediaItemEntity();
      Object.assign(media, this.mediaItemProcessor.buildBaseMediaItem(
        {
          ...mediaInput,
          mediaType: MediaType.VIDEO,
          type: mediaInput.type as MediaUploadType,
          platform: mediaInput.platform as MediaPlatform,
        },
        targetId,
        'VideosPage',
      ));
      this.logger.debug(`📋 Base da mídia construída para targetId: ${targetId}`);
  
      if (mediaInput.type === MediaUploadType.UPLOAD && mediaInput.isLocalFile) {
        const file = filesDict[mediaInput.fieldKey || mediaInput.url];
        if (!file) {
          this.logger.error(`❌ Arquivo ausente para upload: ${mediaInput.fieldKey || mediaInput.url}`);
          throw new BadRequestException(`Arquivo ausente para upload: ${mediaInput.fieldKey || mediaInput.url}`);
        }
        this.logger.debug(`📤 Fazendo upload do arquivo para S3: ${file.originalname}`);
        media.url = await this.awsS3Service.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
        this.logger.debug(`📤 Upload concluído, URL: ${media.url}`);
      } else if (mediaInput.type === MediaUploadType.LINK || mediaInput.isLocalFile === false) {
        if (!mediaInput.url) {
          this.logger.error('❌ URL obrigatória para vídeos do tipo link.');
          throw new BadRequestException('URL obrigatória para vídeos do tipo link.');
        }
        this.logger.debug(`🔗 Usando URL fornecida: ${mediaInput.url}`);
        media.url = mediaInput.url;
        media.isLocalFile = false;
        media.platform = mediaInput.platform || MediaPlatform.YOUTUBE;
      } else {
        this.logger.error(`❌ Tipo de mídia inválido: ${mediaInput.type}`);
        throw new BadRequestException(`Tipo de mídia inválido: ${mediaInput.type}`);
      }
  
      this.logger.debug(`💾 Salvando nova mídia no banco de dados`);
      const savedMedia = await queryRunner.manager.save(MediaItemEntity, media);
      this.logger.debug(`💾 Nova mídia salva com ID: ${savedMedia.id}`);
      return savedMedia;
    }
  
    private async upsertMedia(
      mediaInput: any,
      targetId: string,
      filesDict: Record<string, Express.Multer.File>,
      queryRunner: QueryRunner,
    ): Promise<MediaItemEntity> {
      this.logger.debug(`🔄 Atualizando mídia: id=${mediaInput.id}, type=${mediaInput.type}`);
  
      this.logger.debug(`🔍 Buscando mídia existente com ID: ${mediaInput.id}`);
      const existingMedia = await queryRunner.manager.findOne(MediaItemEntity, { where: { id: mediaInput.id } });
      if (!existingMedia) {
        this.logger.warn(`❌ Mídia com id ${mediaInput.id} não encontrada`);
        throw new NotFoundException(`Mídia com id ${mediaInput.id} não encontrada.`);
      }
      this.logger.debug(`📋 Mídia existente encontrada: URL=${existingMedia.url}`);
  
      const media = new MediaItemEntity();
      Object.assign(media, this.mediaItemProcessor.buildBaseMediaItem(
        {
          ...mediaInput,
          mediaType: MediaType.VIDEO,
          type: mediaInput.type as MediaUploadType,
          platform: mediaInput.platform as MediaPlatform,
        },
        targetId,
        'VideosPage',
      ));
      media.id = mediaInput.id;
      this.logger.debug(`📋 Base da mídia construída para atualização`);
  
      if (mediaInput.type === MediaUploadType.UPLOAD) {
        const file = filesDict[mediaInput.fieldKey];
        if (file) {
          this.logger.debug(`📤 Novo arquivo detectado, fazendo upload para S3: ${file.originalname}`);
          media.url = await this.awsS3Service.upload(file);
          media.isLocalFile = true;
          media.originalName = file.originalname;
          media.size = file.size;
          this.logger.debug(`📤 Upload concluído, nova URL: ${media.url}`);
        } else {
          this.logger.debug(`🔗 Nenhum novo arquivo, mantendo URL existente: ${existingMedia.url}`);
          media.url = existingMedia.url;
          media.isLocalFile = existingMedia.isLocalFile;
          media.originalName = existingMedia.originalName;
          media.size = existingMedia.size;
        }
      } else if (mediaInput.type === MediaUploadType.LINK) {
        if (!mediaInput.url) {
          this.logger.error('❌ URL obrigatória para vídeos do tipo link.');
          throw new BadRequestException('URL obrigatória para vídeos do tipo link.');
        }
        this.logger.debug(`🔗 Atualizando com nova URL: ${mediaInput.url}`);
        media.url = mediaInput.url;
        media.isLocalFile = false;
        media.platform = mediaInput.platform || MediaPlatform.YOUTUBE;
      } else {
        this.logger.error(`❌ Tipo de mídia inválido: ${mediaInput.type}`);
        throw new BadRequestException(`Tipo de mídia inválido: ${mediaInput.type}`);
      }
  
      this.logger.debug(`💾 Salvando mídia atualizada no banco de dados: ID=${mediaInput.id}`);
      const savedMedia = await queryRunner.manager.save(MediaItemEntity, media);
      this.logger.debug(`💾 Mídia atualizada salva com sucesso`);
      return savedMedia;
    }
  }
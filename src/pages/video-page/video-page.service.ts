import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteEntity, RouteType } from 'src/route/route-page.entity';
import { VideosPageRepository } from './video-page.repository';
import { VideosPage } from './entities/video-page.entity';
import { MediaItemEntity, MediaType, MediaUploadType, MediaPlatform } from 'src/share/media/media-item/media-item.entity';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { VideosPageResponseDto } from './dto/videos-page-response.dto';
import { CreateVideosPageDto } from './dto/create-videos-page.dto';
import { UpdateVideosPageDto } from './dto/update-videos-page.dto';

@Injectable()
export class VideosPageService {
  private readonly logger = new Logger(VideosPageService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly videosPageRepo: VideosPageRepository,
    private readonly routeService: RouteService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  /** Cria uma nova página de vídeos */
  async createVideosPage(
    dto: CreateVideosPageDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<VideosPageResponseDto> {
    const { title, description, public: isPublic, videos } = dto;
    this.logger.debug(`🔍 Iniciando criação da página de vídeos: "${title}"`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Criação da página
      const newPage = queryRunner.manager.create(VideosPage, {
        name: title,
        description,
        public: isPublic,
      });
      const savedPage = await queryRunner.manager.save(newPage);

      // Criação da rota
      const path = await this.routeService.generateAvailablePath(title, 'videos_');
      const route = await this.routeService.createRouteWithManager(queryRunner.manager, {
        title,
        subtitle: 'Página de vídeos',
        idToFetch: savedPage.id,
        path,
        entityType: 'VideosPage',
        description,
        entityId: savedPage.id,
        type: RouteType.PAGE,
        image: 'https://bucket-clubinho-galeria.s3.us-east-2.amazonaws.com/uploads/img_card.jpg',
      });

      savedPage.route = route;

      // Processamento dos itens de mídia
      const mediaItems = await this.mediaItemProcessor.processMediaItemsPolymorphic(
        videos.map((video) => ({
          ...video,
          mediaType: MediaType.VIDEO,
          type: video.type as MediaUploadType,
          platform: video.platform as MediaPlatform,
          fileField: video.fieldKey,
        })),
        savedPage.id,
        'VideosPage',
        filesDict,
        this.awsS3Service.upload.bind(this.awsS3Service),
      );

      const finalPage = await queryRunner.manager.save(savedPage);
      await queryRunner.commitTransaction();
      return VideosPageResponseDto.fromEntity(finalPage, mediaItems);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao criar página de vídeos. Rollback executado.', error);
      throw new BadRequestException('Erro ao criar a página de vídeos.');
    } finally {
      await queryRunner.release();
    }
  }

  /** Atualiza uma página de vídeos existente */
  async updateVideosPage(
    id: string,
    dto: UpdateVideosPageDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<VideosPageResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingPage = await this.validateVideosPage(id);
      const existingMedia = await this.validateMedia([existingPage.id]);

      await this.deleteMedia(existingMedia, dto.videos, queryRunner);

      const savedPage = await this.upsertVideosPage(existingPage.id, dto, queryRunner);
      const savedRoute = await this.upsertRoute(existingPage.route.id, dto, savedPage.id);

      const mediaItems = await this.processPageMedia(
        dto.videos,
        savedPage.id,
        existingMedia,
        filesDict,
        queryRunner,
      );

      savedPage.route = savedRoute;
      const finalPage = await queryRunner.manager.save(savedPage);

      await queryRunner.commitTransaction();
      return VideosPageResponseDto.fromEntity(finalPage, mediaItems);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao atualizar página de vídeos. Rollback executado.', error);
      throw new BadRequestException('Erro ao atualizar a página de vídeos.');
    } finally {
      await queryRunner.release();
    }
  }

  /** Lista todas as páginas de vídeos */
  async findAllPages(): Promise<VideosPageResponseDto[]> {
    this.logger.debug('📡 Listando todas as páginas de vídeos...');
    const pages = await this.videosPageRepo.findAll();
    const pageIds = pages.map((page) => page.id);
    const mediaItems = await this.mediaItemProcessor.findManyMediaItemsByTargets(pageIds, 'VideosPage');

    const mediaMap = new Map<string, MediaItemEntity[]>();
    for (const item of mediaItems) {
      if (!mediaMap.has(item.targetId)) mediaMap.set(item.targetId, []);
      mediaMap.get(item.targetId)!.push(item);
    }

    return pages.map((page) => VideosPageResponseDto.fromEntity(page, mediaMap.get(page.id) || []));
  }

  /** Busca uma única página de vídeos por ID */
  async findOnePage(id: string): Promise<VideosPageResponseDto> {
    this.logger.debug(`📡 Buscando página de vídeos ID=${id}...`);
    const page = await this.videosPageRepo.findById(id);
    if (!page) throw new NotFoundException('Página de vídeos não encontrada.');

    const mediaItems = await this.mediaItemProcessor.findMediaItemsByTarget(page.id, 'VideosPage');
    return VideosPageResponseDto.fromEntity(page, mediaItems);
  }

  /** Remove uma página de vídeos */
  async removePage(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const page = await this.videosPageRepo.findById(id);
      if (!page) throw new NotFoundException(`Página com id ${id} não encontrada`);

      const mediaItems = await this.mediaItemProcessor.findMediaItemsByTarget(page.id, 'VideosPage');
      await this.mediaItemProcessor.deleteMediaItems(mediaItems, this.awsS3Service.delete.bind(this.awsS3Service));

      if (page.route?.id) {
        await this.routeService.removeRoute(page.route.id);
      }

      await queryRunner.manager.remove(page);
      await queryRunner.commitTransaction();
      this.logger.debug(`✅ Página de vídeos removida com sucesso: ID=${id}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao remover página de vídeos. Rollback executado.', error);
      throw new BadRequestException('Erro ao remover a página de vídeos.');
    } finally {
      await queryRunner.release();
    }
  }

  // Métodos auxiliares

  private async validateVideosPage(id: string): Promise<VideosPage> {
    const page = await this.videosPageRepo.findById(id);
    if (!page) throw new NotFoundException('Página não encontrada');
    this.logger.debug(`✅ Página validada: ${page.id}`);
    return page;
  }

  private async validateMedia(pageIds: string[]): Promise<MediaItemEntity[]> {
    const media = await this.mediaItemProcessor.findManyMediaItemsByTargets(pageIds, 'VideosPage');
    if (!media || media.length === 0) {
      this.logger.debug('⚠️ Nenhuma mídia associada encontrada');
      return [];
    }
    this.logger.debug(`✅ Mídias validadas: ${media.length} itens`);
    return media;
  }

  private async deleteMedia(
    existingMedia: MediaItemEntity[],
    requestedMedia: any[],
    queryRunner: QueryRunner,
  ): Promise<void> {
    const requestedMediaIds = requestedMedia.map((media) => media.id).filter((id) => id);
    const mediaToRemove = existingMedia.filter(
      (existing) => !requestedMediaIds.includes(existing.id),
    );
    for (const media of mediaToRemove) {
      this.logger.debug(`🗑️ Removendo mídia ID: ${media.id}`);
      await this.mediaItemProcessor.removeMediaItem(media, this.awsS3Service.delete.bind(this.awsS3Service));
      await queryRunner.manager.remove(MediaItemEntity, media);
    }
  }

  private async upsertVideosPage(
    id: string,
    dto: UpdateVideosPageDto,
    queryRunner: QueryRunner,
  ): Promise<VideosPage> {
    const pageToUpsert: Partial<VideosPage> = {
      id,
      name: dto.title,
      description: dto.description,
      public: dto.public,
    };
    const savedPage = await queryRunner.manager.save(VideosPage, pageToUpsert);
    this.logger.debug(`✅ Página upsertada: ${savedPage.id}`);
    return savedPage;
  }

  private async upsertRoute(
    routeId: string,
    dto: UpdateVideosPageDto,
    pageId: string,
  ): Promise<RouteEntity> {
    const routeData: Partial<RouteEntity> = {
      id: routeId,
      title: dto.title,
      subtitle: 'Página de vídeos',
      idToFetch: pageId,
      entityType: 'VideosPage',
      entityId: pageId,
      type: RouteType.PAGE,
      description: dto.description,
      path: await this.routeService.generateAvailablePath(dto.title, 'videos_'),
    };
    const savedRoute = await this.routeService.upsertRoute(routeId, routeData);
    this.logger.debug(`✅ Rota upsertada: ${savedRoute.id}`);
    return savedRoute;
  }

  private async processPageMedia(
    mediaItems: any[],
    pageId: string,
    oldMedia: MediaItemEntity[],
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity[]> {
    const processedMedia: MediaItemEntity[] = [];
    for (const mediaInput of mediaItems) {
      if (mediaInput.id) {
        const savedMedia = await this.upsertMedia(mediaInput, pageId, filesDict, queryRunner);
        processedMedia.push(savedMedia);
      } else {
        const savedMedia = await this.addMedia(mediaInput, pageId, filesDict, queryRunner);
        processedMedia.push(savedMedia);
      }
    }
    return processedMedia;
  }

  private async addMedia(
    mediaInput: any,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      {
        ...mediaInput,
        mediaType: MediaType.VIDEO,
        type: mediaInput.type as MediaUploadType,
        platform: mediaInput.platform as MediaPlatform,
      },
      targetId,
      'VideosPage',
    );
    if (mediaInput.type === 'upload') {
      const file = filesDict[mediaInput.fieldKey || mediaInput.url];
      if (!file) throw new BadRequestException(`Arquivo ausente para upload: ${mediaInput.fieldKey || mediaInput.url}`);
      media.url = await this.awsS3Service.upload(file);
      media.isLocalFile = true;
      media.originalName = file.originalname;
      media.size = file.size;
    }
    const savedMedia = await queryRunner.manager.save(MediaItemEntity, media);
    this.logger.debug(`🆕 Mídia adicionada: ${savedMedia.id}`);
    return savedMedia;
  }

  private async upsertMedia(
    mediaInput: any,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      {
        ...mediaInput,
        mediaType: MediaType.VIDEO,
        type: mediaInput.type as MediaUploadType,
        platform: mediaInput.platform as MediaPlatform,
      },
      targetId,
      'VideosPage',
    );
    if (mediaInput.type === 'upload' && !mediaInput.url) {
      const file = filesDict[mediaInput.fieldKey || mediaInput.url];
      if (!file) throw new BadRequestException(`Arquivo ausente para upload: ${mediaInput.fieldKey || mediaInput.url}`);
      media.url = await this.awsS3Service.upload(file);
      media.isLocalFile = true;
      media.originalName = file.originalname;
      media.size = file.size;
    }
    const savedMedia = await queryRunner.manager.save(MediaItemEntity, { ...media, id: mediaInput.id });
    this.logger.debug(`✅ Mídia upsertada: ${savedMedia.id}`);
    return savedMedia;
  }
}
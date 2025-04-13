import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteEntity, RouteType } from 'src/route/route-page.entity';
import { ImagePageRepository } from './repository/image-page.repository';
import { CreateImagePageDto } from './dto/create-image.dto';
import { ImagePageResponseDto } from './dto/image-page-response.dto';
import { ImagePageEntity } from './entity/Image-page.entity';
import { ImageSectionEntity } from './entity/Image-section.entity';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { ImageSectionRepository } from './repository/image-section.repository';
import { UpdateImagePageDto, UpdateMediaItemDto, UpdateSectionDto } from './dto/update-image.dto';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly imagePageRepository: ImagePageRepository,

    private readonly imageSectionRepository: ImageSectionRepository,
    private readonly routeService: RouteService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) { }

  async createImagePage(
    pageData: CreateImagePageDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<ImagePageResponseDto> {
    const { title, description, public: isPublic, sections } = pageData;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const gallery = queryRunner.manager.create(ImagePageEntity, {
        name: title,
        description,
        public: isPublic,
      });
      const savedGallery = await queryRunner.manager.save(gallery);

      const path = await this.routeService.generateAvailablePath(title, 'galeria_imagens_');
      const route = await this.routeService.createRouteWithManager(queryRunner.manager, {
        title,
        public: isPublic,
        subtitle: 'Página de galeria de imagens',
        idToFetch: savedGallery.id,
        path,
        entityType: 'ImagesPage',
        description,
        entityId: savedGallery.id,
        type: RouteType.PAGE,
        image: 'https://bucket-clubinho-galeria.s3.us-east-2.amazonaws.com/uploads/img_card.jpg',
      });

      savedGallery.route = route;
      await queryRunner.manager.save(savedGallery);

      const mediaMap = new Map<string, MediaItemEntity[]>();
      const sectionList: ImageSectionEntity[] = [];

      for (const sectionInput of sections) {
        const section = queryRunner.manager.create(ImageSectionEntity, {
          caption: sectionInput.caption,
          description: sectionInput.description,
          public: sectionInput.public,
          page: savedGallery,
        });

        const savedSection = await queryRunner.manager.save(section);
        sectionList.push(savedSection);

        const mediaItemsPrepared = sectionInput.mediaItems.map((item) => {
          if (item.type === 'upload' && item.isLocalFile) {
            if (!item.originalName) {
              throw new Error('Campo originalName ausente no item de upload.');
            }
            if (!item.fieldKey || !filesDict[item.fieldKey]) {
              throw new Error(`Arquivo não encontrado para fieldKey: ${item.fieldKey}`);
            }
          }

          return {
            ...item,
            fileField: item.fieldKey,
          };
        });

        const mediaItems = await this.mediaItemProcessor.processMediaItemsPolymorphic(
          mediaItemsPrepared,
          savedSection.id,
          MediaTargetType.ImagesPage,
          filesDict,
          this.awsS3Service.upload.bind(this.awsS3Service),
        );

        mediaMap.set(savedSection.id, mediaItems);
      }

      savedGallery.sections = sectionList;
      const finalGallery = await queryRunner.manager.save(savedGallery);

      await queryRunner.commitTransaction();
      return ImagePageResponseDto.fromEntity(finalGallery, mediaMap);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao criar galeria. Rollback executado.', error);
      throw new BadRequestException('Erro ao criar a galeria. Nenhum dado foi salvo.');
    } finally {
      await queryRunner.release();
    }
  }

  async updateImagePage(
    id: string,
    pageData: UpdateImagePageDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<ImagePageResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const imagePageExisting = await this.validateImagePage(id);
      const imageSectionExisting = await this.validateSections(imagePageExisting.id);
      const imagePageRouteExisting = await this.validateRoute(imagePageExisting.id);
      const oldMedia = await this.validateMedia(imageSectionExisting.map(section => section.id));

      await this.deleteSections(imageSectionExisting, pageData.sections, queryRunner);
      await this.deleteMedia(oldMedia, pageData.sections, queryRunner);

      const savedImagePage = await this.upsertImagePage(imagePageExisting.id, pageData, queryRunner);
      const savedRoute = await this.upsertRoute(imagePageRouteExisting.id, pageData, savedImagePage.id);

      const updatedSections: ImageSectionEntity[] = [];
      const mediaMap = new Map<string, MediaItemEntity[]>();

      for (const sectionInput of pageData.sections) {
        let savedSection: ImageSectionEntity;

        if (sectionInput.id) {
          savedSection = await this.upsertSection(sectionInput, savedImagePage, queryRunner);
        } else {
          savedSection = await this.addSection(sectionInput, savedImagePage, queryRunner);
        }
        updatedSections.push(savedSection);

        const oldSectionMedia = oldMedia.filter(m => m.targetId === savedSection.id);
        const processedMedia = await this.processSectionMedia(
          sectionInput.mediaItems,
          savedSection.id,
          oldSectionMedia,
          filesDict,
          queryRunner
        );
        mediaMap.set(savedSection.id, processedMedia);
      }

      savedImagePage.sections = updatedSections;
      savedImagePage.route = savedRoute;
      const finalImagePage = await queryRunner.manager.save(ImagePageEntity, savedImagePage);

      await queryRunner.commitTransaction();
      return ImagePageResponseDto.fromEntity(finalImagePage, mediaMap);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao atualizar galeria', error);
      throw new BadRequestException('Erro ao atualizar a galeria. Nenhum dado foi salvo.');
    } finally {
      await queryRunner.release();
    }
  }
  async validateImagePage(id: string): Promise<ImagePageEntity> {
    const imagePage = await this.imagePageRepository.findByIdWithSections(id);
    if (!imagePage) throw new NotFoundException('Página não encontrada');
    this.logger.debug(`✅ Galeria validada: ${imagePage.id}`);
    return imagePage;
  }

  async validateSections(pageId: string): Promise<ImageSectionEntity[]> {
    const sections = await this.imageSectionRepository.findByPageId(pageId);
    if (!sections || sections.length === 0) {
      throw new NotFoundException('Seções da galeria não encontradas');
    }
    this.logger.debug(`✅ Seções validadas: ${sections.length} seções`);
    return sections;
  }

  async validateRoute(entityId: string): Promise<RouteEntity> {
    const route = await this.routeService.findRouteByEntityId(entityId);
    if (!route) throw new NotFoundException('Rota da galeria não encontrada');
    this.logger.debug(`✅ Rota validada: ${route.id}`);
    return route;
  }

  async validateMedia(sectionIds: string[]): Promise<MediaItemEntity[]> {
    const media = await this.mediaItemProcessor.findManyMediaItemsByTargets(sectionIds, 'ImagesPage');
    if (!media || media.length === 0) {
      throw new NotFoundException('Mídias associadas à galeria não encontradas');
    }
    this.logger.debug(`✅ Mídias validadas: ${media.length} mídias`);
    return media;
  }

  async upsertImagePage(
    id: string,
    pageData: UpdateImagePageDto,
    queryRunner: QueryRunner
  ): Promise<ImagePageEntity> {
    const imagePageToUpsert: Partial<ImagePageEntity> = {
      id,
      name: pageData.title,
      description: pageData.description,
      public: pageData.public,
    };
    const savedImagePage = await queryRunner.manager.save(ImagePageEntity, imagePageToUpsert);
    this.logger.debug(`✅ Galeria upsertada: ${savedImagePage.id}`);
    return savedImagePage;
  }


  async addSection(
    sectionInput: UpdateSectionDto,
    imagePage: ImagePageEntity,
    queryRunner: QueryRunner
  ): Promise<ImageSectionEntity> {
    const sectionToAdd: Partial<ImageSectionEntity> = {
      caption: sectionInput.caption,
      description: sectionInput.description,
      public: sectionInput.public,
      page: imagePage,
    };
    const savedSection = await queryRunner.manager.save(ImageSectionEntity, sectionToAdd);
    this.logger.debug(`🆕 Seção adicionada: ${savedSection.id}`);
    return savedSection;
  }


  async deleteSections(
    existingSections: ImageSectionEntity[],
    requestedSections: UpdateSectionDto[],
    queryRunner: QueryRunner
  ): Promise<void> {
    const sectionsToRemove = existingSections.filter(
      existing => !requestedSections.some(requested => requested.id === existing.id)
    );
    for (const section of sectionsToRemove) {
      this.logger.debug(`🗑️ Removendo seção ID: ${section.id}`);
      await queryRunner.manager.remove(ImageSectionEntity, section);
    }
  }

  async deleteMedia(
    existingMedia: MediaItemEntity[],
    requestedSections: UpdateSectionDto[],
    queryRunner: QueryRunner
  ): Promise<void> {
    const requestedMediaIds = requestedSections.flatMap(section => section.mediaItems.map(media => media.id));
    const mediaToRemove = existingMedia.filter(
      existing => !requestedMediaIds.includes(existing.id)
    );
    for (const media of mediaToRemove) {
      this.logger.debug(`🗑️ Removendo mídia ID: ${media.id}`);
      await this.mediaItemProcessor.removeMediaItem(media, this.awsS3Service.delete.bind(this.awsS3Service));
      await queryRunner.manager.remove(MediaItemEntity, media);
    }
  }

  async addMedia(
    mediaInput: UpdateMediaItemDto,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(mediaInput, targetId, 'ImagesPage');
    if (mediaInput.isLocalFile) {
      const file = filesDict[mediaInput.fieldKey || mediaInput.url];
      if (!file) throw new Error(`Arquivo ausente para upload: ${mediaInput.fieldKey || mediaInput.url}`);
      media.url = await this.awsS3Service.upload(file);
      media.originalName = file.originalname;
      media.size = file.size;
    }
    const savedMedia = await queryRunner.manager.save(MediaItemEntity, media);
    this.logger.debug(`🆕 Mídia adicionada: ${savedMedia.id}`);
    return savedMedia;
  }

  async upsertSection(
    sectionInput: UpdateSectionDto,
    imagePage: ImagePageEntity,
    queryRunner: QueryRunner
  ): Promise<ImageSectionEntity> {
    const sectionToUpsert: Partial<ImageSectionEntity> = {
      id: sectionInput.id,
      caption: sectionInput.caption,
      description: sectionInput.description,
      public: sectionInput.public,
      page: imagePage,
    };
    const savedSection = await queryRunner.manager.save(ImageSectionEntity, sectionToUpsert);
    this.logger.debug(`✅ Seção upsertada: ${savedSection.id}`);
    return savedSection;
  }

  async upsertMedia(
    mediaInput: UpdateMediaItemDto,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner
  ): Promise<MediaItemEntity> {
    const media = this.mediaItemProcessor.buildBaseMediaItem(mediaInput, targetId, 'ImagesPage');
    if (mediaInput.isLocalFile && !mediaInput.id) {
      const file = filesDict[mediaInput.fieldKey || mediaInput.url];
      if (!file) throw new Error(`Arquivo ausente para upload: ${mediaInput.fieldKey || mediaInput.url}`);
      media.url = await this.awsS3Service.upload(file);
      media.originalName = file.originalname;
      media.size = file.size;
    }
    const savedMedia = await queryRunner.manager.save(MediaItemEntity, { ...media, id: mediaInput.id });
    this.logger.debug(`✅ Mídia upsertada: ${savedMedia.id}`);
    return savedMedia;
  }

  async upsertRoute(
    routeId: string,
    pageData: UpdateImagePageDto,
    imagePageId: string
  ): Promise<RouteEntity> {
    const routeData: Partial<RouteEntity> = {
      title: pageData.title,
      subtitle: 'Página de galeria de imagens',
      idToFetch: imagePageId,
      entityType: 'ImagesPage',
      entityId: imagePageId,
      public: pageData.public,
      type: RouteType.PAGE,
      description: pageData.description,
      path: 'galeria_imagens_',
      image: 'https://bucket-clubinho-galeria.s3.us-east-2.amazonaws.com/uploads/img_card.jpg'
    };
    const savedRoute = await this.routeService.upsertRoute(routeId, routeData);
    this.logger.debug(`✅ Rota upsertada: ${savedRoute.id}`);
    return savedRoute;
  }
  
  async processSectionMedia(
    mediaItems: UpdateMediaItemDto[],
    sectionId: string,
    oldMedia: MediaItemEntity[],
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner
  ): Promise<MediaItemEntity[]> {
    const processedMedia: MediaItemEntity[] = [];
    for (const mediaInput of mediaItems) {
      if (mediaInput.id) {
        const savedMedia = await this.upsertMedia(mediaInput, sectionId, filesDict, queryRunner);
        processedMedia.push(savedMedia);
      } else {
        const savedMedia = await this.addMedia(mediaInput, sectionId, filesDict, queryRunner);
        processedMedia.push(savedMedia);
      }
    }
    return processedMedia;
  }
  async removePage(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const page = await this.imagePageRepository.findByIdWithSections(id);
      if (!page) throw new NotFoundException(`Página com id ${id} não encontrada`);

      const sectionIds = page.sections?.map((s) => s.id) || [];
      if (sectionIds.length > 0) {
        const media = await this.mediaItemProcessor.findManyMediaItemsByTargets(sectionIds, 'ImagesPage');
        await this.mediaItemProcessor.deleteMediaItems(media, this.awsS3Service.delete.bind(this.awsS3Service));
      }

      if (page.route?.id) {
        await this.routeService.removeRoute(page.route.id);
      }

      await queryRunner.manager.remove(page);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao remover galeria. Rollback executado.', error);
      throw new BadRequestException('Erro ao remover a galeria.');
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<ImagePageResponseDto[]> {
    const pages = await this.imagePageRepository.findAllWithSections();
    const sectionIds = pages.flatMap((page) => page.sections.map((s) => s.id));
    const mediaItems = await this.mediaItemProcessor.findManyMediaItemsByTargets(sectionIds, 'ImagesPage');

    const mediaMap = new Map<string, MediaItemEntity[]>();
    for (const item of mediaItems) {
      if (!mediaMap.has(item.targetId)) mediaMap.set(item.targetId, []);
      mediaMap.get(item.targetId)!.push(item);
    }

    return pages.map((page) => ImagePageResponseDto.fromEntity(page, mediaMap));
  }

  async findOne(id: string): Promise<ImagePageResponseDto> {
    const page = await this.imagePageRepository.findByIdWithSections(id);
    if (!page) throw new NotFoundException('Página de galeria não encontrada.');
    if (!page.route) throw new NotFoundException(`A galeria com id ${id} não possui rota associada.`);

    const sectionIds = page.sections.map((s) => s.id);
    const media = await this.mediaItemProcessor.findManyMediaItemsByTargets(sectionIds, 'ImagesPage');

    const mediaMap = new Map<string, MediaItemEntity[]>();
    for (const item of media) {
      if (!mediaMap.has(item.targetId)) mediaMap.set(item.targetId, []);
      mediaMap.get(item.targetId)!.push(item);
    }

    return ImagePageResponseDto.fromEntity(page, mediaMap);
  }
}
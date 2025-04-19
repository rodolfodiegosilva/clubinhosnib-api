import { Injectable, Logger } from '@nestjs/common';
import { MediaItemEntity, UploadType } from './media-item/media-item.entity';
import { MediaItemRepository } from './media-item-repository';

@Injectable()
export class MediaItemProcessor {
  private readonly logger = new Logger(MediaItemProcessor.name);

  constructor(private readonly mediaRepo: MediaItemRepository) { }

  async findMediaItemsByTarget(targetId: string, targetType: string): Promise<MediaItemEntity[]> {
    return this.mediaRepo.findByTarget(targetId, targetType);
  }

  async findMediaItemByTarget(targetId: string, targetType: string): Promise<MediaItemEntity | null> {
    const items = await this.findMediaItemsByTarget(targetId, targetType);
    return items.length > 0 ? items[0] : null;
  }


  async findManyMediaItemsByTargets(targetIds: string[], targetType: string): Promise<MediaItemEntity[]> {
    return this.mediaRepo.findManyByTargets(targetIds, targetType);
  }

  buildBaseMediaItem(item: any, targetId: string, targetType: string): MediaItemEntity {
    const media = new MediaItemEntity();
    media.title = item.title;
    media.description = item.description;
    media.mediaType = item.mediaType;
    media.uploadType = item.uploadType;
    media.platformType = item.platformType;
    media.url = item.url;
    media.originalName = item.originalName;
    media.size = item.size;
    media.isLocalFile = item.isLocalFile;
    media.targetId = targetId;
    media.targetType = targetType;
    return media;
  }


  async saveMediaItem(media: MediaItemEntity): Promise<MediaItemEntity> {
    return this.mediaRepo.save(media);
  }

  async upsertMediaItem(id: string | undefined, media: MediaItemEntity): Promise<MediaItemEntity> {
    if (id) {
      await this.mediaRepo.saveById(id, media);
      this.logger.debug(`✏️ Atualizada mídia ID=${id} (${media.title})`);
      media.id = id; // garantir consistência
      return media;
    } else {
      const created = await this.saveMediaItem(media);
      this.logger.debug(`🆕 Criada mídia ID=${created.id} (${created.title})`);
      return created;
    }
  }

  async deleteMediaItems(items: MediaItemEntity[], deleteFn: (url: string) => Promise<void>): Promise<void> {
    for (const item of items) {
      if (item.isLocalFile) {
        this.logger.debug(`🗑️ Removendo arquivo do S3: ${item.url}`);
        await deleteFn(item.url);
      }
    }
    await this.mediaRepo.removeMany(items);
  }

  async removeMediaItem(item: MediaItemEntity, deleteFn?: (url: string) => Promise<void>): Promise<void> {
    if (item.isLocalFile && deleteFn) {
      this.logger.debug(`🧹 Limpando S3: ${item.url}`);
      await deleteFn(item.url);
    }
    await this.mediaRepo.removeOne(item);
  }

  async processMediaItemsPolymorphic(
    items: any[],
    targetId: string,
    targetType: string,
    filesDict: Record<string, Express.Multer.File>,
    uploadFn: (file: Express.Multer.File) => Promise<string>,
  ): Promise<MediaItemEntity[]> {
    const mediaItems: MediaItemEntity[] = [];

    for (const item of items) {
      const media = this.buildBaseMediaItem(item, targetId, targetType);

      if (item.uploadType === UploadType.UPLOAD) {
        const file = filesDict[item.fileField];
        if (!file) throw new Error(`Arquivo ausente para upload: ${item.fileField}`);

        this.logger.debug(`⬆️ Enviando arquivo para S3: ${file.originalname}`);
        media.url = await uploadFn(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
      } else {
        media.url = item.url?.trim() || '';
        media.isLocalFile = false;
      }

      const saved = await this.saveMediaItem(media);
      mediaItems.push(saved);
    }

    return mediaItems;
  }

  async cleanAndReplaceMediaItems(
    items: any[],
    targetId: string,
    targetType: string,
    filesDict: Record<string, Express.Multer.File>,
    oldItems: MediaItemEntity[],
    deleteFn: (url: string) => Promise<void>,
    uploadFn: (file: Express.Multer.File) => Promise<string>,
  ): Promise<MediaItemEntity[]> {
    const logger = new Logger('MediaItemCleaner');

    logger.debug(`📦 Substituindo mídias para targetId=${targetId}`);
    logger.debug(`📥 Antigas: ${oldItems.length}, Novas: ${items.length}`);

    const validIncoming = items.filter((item) => {
      if (item.type !== 'upload') return true;

      const fileRef = item.url || item.fileField;
      const hasPrevious = oldItems.some((old) => old.url === fileRef);
      const hasFile = !!(item.fileField && filesDict[item.fileField]);

      if (!hasPrevious && !hasFile) {
        logger.warn(`⚠️ Upload ignorado: sem referência nem arquivo para "${item.title}"`);
      }

      return hasPrevious || hasFile;
    });

    const validUploadUrls = new Set(
      validIncoming
        .filter((item) => item.uploadType === UploadType.UPLOAD)
        .map((item) => {
          const fileRef = item.url || item.fileField;
          const previous = oldItems.find((old) => old.url === fileRef);
          return previous?.url;
        })
        .filter((url): url is string => !!url),
    );

    const toRemove = oldItems.filter((item) => {
      if (!item.isLocalFile) return false;
      return !validUploadUrls.has(item.url);
    });

    logger.debug(`🗑️ Arquivos para remoção: ${toRemove.length}`);
    await this.deleteMediaItems(toRemove, deleteFn);

    const newItems: MediaItemEntity[] = [];

    for (const item of validIncoming) {
      const media = this.buildBaseMediaItem(item, targetId, targetType);

      if (item.uploadType === UploadType.UPLOAD) {
        const fileRef = item.url || item.fileField;
        const previous = oldItems.find((old) => old.url === fileRef);

        if (previous) {
          logger.debug(`🔁 Reutilizando upload: ${previous.originalName}`);
          media.url = previous.url;
          media.isLocalFile = previous.isLocalFile;
          media.originalName = previous.originalName;
          media.size = previous.size;
        } else {
          const file = filesDict[item.fileField];
          if (!file) throw new Error(`Arquivo ausente para nova mídia: ${item.title}`);

          logger.debug(`⬆️ Upload novo arquivo: ${file.originalname}`);
          media.url = await uploadFn(file);
          media.isLocalFile = true;
          media.originalName = file.originalname;
          media.size = file.size;
        }
      } else {
        media.url = item.url?.trim() || '';
        media.isLocalFile = false;
      }

      const saved = await this.upsertMediaItem(item.id, media);
      newItems.push(saved);
    }

    return newItems;
  }
}

import { RouteType } from 'src/route/route-page.entity';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity/week-material-page.entity';
import { Logger } from '@nestjs/common';
import { MediaItemEntity, MediaPlatform, MediaType, MediaUploadType } from 'src/share/media/media-item/media-item.entity';

export class weekMediaItemResponseDTO {
  id: string;
  title: string;
  description: string;
  type: MediaUploadType;
  mediaType: MediaType;
  platform?: MediaPlatform;
  url: string;
  isLocalFile?: boolean;
  size?: number;
  originalName?: string;
}

export class weekRouteResponseDTO {
  id: string;
  path: string;
  title: string;
  subtitle: string;
  description: string;
  type: RouteType;
}

export class WeekMaterialsPageResponseDTO {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  route: weekRouteResponseDTO;
  videos: weekMediaItemResponseDTO[];
  documents: weekMediaItemResponseDTO[];
  images: weekMediaItemResponseDTO[];
  audios: weekMediaItemResponseDTO[];
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(
    entity: WeekMaterialsPageEntity,
    mediaItems: MediaItemEntity[] = []
  ): WeekMaterialsPageResponseDTO {
    const logger = new Logger(WeekMaterialsPageResponseDTO.name);
    logger.debug(`🧩 Convertendo entidade para DTO: ID=${entity.id}`);

    const dto = new WeekMaterialsPageResponseDTO();

    dto.id = entity.id;
    dto.title = entity.title;
    dto.subtitle = entity.subtitle;
    dto.description = entity.description;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    logger.debug(`🛤️ Mapeando rota da página: ${entity.route?.path}`);
    dto.route = {
      id: entity.route.id,
      path: entity.route.path,
      title: entity.route.title,
      subtitle: entity.route.subtitle,
      description: entity.route.description,
      type: entity.route.type,
    };

    const mapItem = (item: MediaItemEntity): weekMediaItemResponseDTO => {
      logger.debug(`🎞️ Mapeando mídia: ID=${item.id}, tipo=${item.mediaType}`);
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        type: item.type,
        mediaType: item.mediaType,
        platform: item.platform,
        url: item.url,
        isLocalFile: item.isLocalFile,
        size: item.size,
        originalName: item.originalName,
      };
    };

    dto.videos = mediaItems.filter((i) => i.mediaType === MediaType.VIDEO).map(mapItem);
    dto.documents = mediaItems.filter((i) => i.mediaType === MediaType.DOCUMENT).map(mapItem);
    dto.images = mediaItems.filter((i) => i.mediaType === MediaType.IMAGE).map(mapItem);
    dto.audios = mediaItems.filter((i) => i.mediaType === MediaType.AUDIO).map(mapItem);

    logger.debug(`✅ DTO criado com sucesso. ID=${dto.id}`);
    return dto;
  }
}
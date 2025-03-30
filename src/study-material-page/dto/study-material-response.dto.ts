import { RouteType } from 'src/route/route-page.entity';
import {
  StudyMediaItem,
  StudyMediaPlatform,
  StudyMediaType,
} from '../entities/study-media-item/StudyMediaItem';
import { StudyMaterialsPage } from '../entities/study-material-page.entity/study-material-page.entity';

export class StudyMediaItemResponseDTO {
  id: string;
  title: string;
  description: string;
  type: 'upload' | 'link';
  mediaType: StudyMediaType;
  platform?: StudyMediaPlatform;
  url: string;
  isLocalFile?: boolean;
  size?: number;
  originalName?: string;
}

export class StudyRouteResponseDTO {
  id: string;
  path: string;
  title: string;
  subtitle: string;
  description: string;
  type: RouteType;
}

export class StudyMaterialsPageResponseDTO {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  route: StudyRouteResponseDTO;
  videos: StudyMediaItemResponseDTO[];
  documents: StudyMediaItemResponseDTO[];
  images: StudyMediaItemResponseDTO[];
  audios: StudyMediaItemResponseDTO[];
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: StudyMaterialsPage): StudyMaterialsPageResponseDTO {
    const dto = new StudyMaterialsPageResponseDTO();

    dto.id = entity.id;
    dto.title = entity.title;
    dto.subtitle = entity.subtitle;
    dto.description = entity.description;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    dto.route = {
      id: entity.route.id,
      path: entity.route.path,
      title: entity.route.title,      
      subtitle: entity.route.subtitle,
      description: entity.route.description,
      type: entity.route.type,
    };

    const allItems = entity.mediaItems || [];

    const mapItem = (item: StudyMediaItem): StudyMediaItemResponseDTO => ({
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
    });

    dto.videos = allItems.filter((i) => i.mediaType === StudyMediaType.VIDEO).map(mapItem);
    dto.documents = allItems.filter((i) => i.mediaType === StudyMediaType.DOCUMENT).map(mapItem);
    dto.images = allItems.filter((i) => i.mediaType === StudyMediaType.IMAGE).map(mapItem);
    dto.audios = allItems.filter((i) => i.mediaType === StudyMediaType.AUDIO).map(mapItem);

    return dto;
  }
}

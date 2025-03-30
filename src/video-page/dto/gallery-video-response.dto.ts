
import { RouteType } from 'src/route/route-page.entity';
import { VideoItem, VideoPlatform, VideoType } from '../entities/video-item.entity/video-item.entity';
import { VideosPage } from '../entities/video-page.entity/video-page.entity';

export class VideoItemResponseDTO {
  id: string;
  title: string;
  description: string;
  type: VideoType;
  isLocalFile?: boolean;
  platform?: VideoPlatform;
  url: string;
  size?: number;
  originalName?: string;
}

export class VideoRouteResponseDTO {
  id: string;
  path: string;
  title: string;
  subtitle: string;
  description: string;
  type: RouteType;
}

export class VideosPageResponseDTO {
  id: string;
  name: string;
  description: string;
  route: VideoRouteResponseDTO;
  videos: VideoItemResponseDTO[];
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: VideosPage): VideosPageResponseDTO {
    const dto = new VideosPageResponseDTO();
    dto.id = entity.id;
    dto.name = entity.name;
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

    dto.videos = entity.videos.map((video: VideoItem) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      type: video.type,
      platform: video.platform,
      url: video.url,
      size: video.size,
      originalName: video.originalName,
    }));

    return dto;
  }
}

import { GalleryImage } from '../gallery-image.entity';
import { GalleryPage } from '../gallery-page.entity';
import { GallerySection } from '../gallery-section.entity';

export class GalleryImageResponseDTO {
  id: string;
  url: string;
  isLocalFile: boolean;
  originalName?: string;
  size?: number;
}

export class GallerySectionResponseDTO {
  id: string;
  caption: string;
  description: string;
  images: GalleryImageResponseDTO[];
}

export class GalleryRouteResponseDTO {
  id: string;
  path: string;
  title: string;
  subtitle: string;
  description: string;
  type: string;
}

export class GalleryPageResponseDTO {
  id: string;
  name: string;
  description: string;
  route: GalleryRouteResponseDTO;
  sections: GallerySectionResponseDTO[];
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: GalleryPage): GalleryPageResponseDTO {
    const dto = new GalleryPageResponseDTO();
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
    dto.sections = entity.sections.map((section: GallerySection) => ({
      id: section.id,
      caption: section.caption,
      description: section.description,
      images: section.images?.map((img: GalleryImage) => ({
        id: img.id,
        url: img.url,
        isLocalFile: img.isLocalFile,
        originalName: img.originalName,
        size: img.size,
      })) || [],
    }));
    return dto;
  }
}

export class MediaItemDto {
  id: string;
  title: string;
  description: string;
  mediaType: 'video' | 'document' | 'image' | 'audio';
  type: 'link' | 'upload';
  url: string;
  isLocalFile: boolean;
  platformType?: 'youtube' | 'googledrive' | 'onedrive' | 'dropbox' | 'any';
  originalName?: string;
  size?: number;
  createdAt?: Date;
  updatedAt?: Date;

  static fromEntity(entity: any): MediaItemDto {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      mediaType: entity.mediaType,
      type: entity.type,
      url: entity.url,
      isLocalFile: entity.isLocalFile,
      platformType: entity.platformType ?? undefined,
      originalName: entity.originalName ?? undefined,
      size: entity.size ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}



export class DocumentDto {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  media: MediaItemDto | null;

  static fromEntity(document: any, media?: any): DocumentDto {
    return {
      id: document.id,
      name: document.name,
      description: document.description,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      media: media ? MediaItemDto.fromEntity(media) : null,
    };
  }
}




[
  {
    "id": "62283792-1914-44af-852e-73e9345c12d8",
    "name": "teste 3",
    "description": "teste 3",
    "createdAt": "2025-04-14T03:23:28.223Z",
    "updatedAt": "2025-04-14T03:23:28.223Z",
    "media": {
      "id": "a6dce2c6-e096-4e59-9c20-0201685bbaa4",
      "title": "teste 3",
      "description": "teste 3",
      "mediaType": "document",
      "type": "link",
      "url": "https://drive.google.com/file/d/1UyJwZUyW7Aj9d6vWly3eUPGw-D-QcjZm/view?usp=drive_link",
      "isLocalFile": false,
      "platformType": "googledrive",
      "originalName": null,
      "size": null,
      "createdAt": "2025-04-14T03:23:29.019Z",
      "updatedAt": "2025-04-14T03:23:29.019Z"
    }
  }
  ,
  {
    "id": "1062fbd9-4268-4d39-986b-3e9c478920e3",
    "name": "teste 2",
    "description": "teste 2",
    "createdAt": "2025-04-14T03:22:58.409Z",
    "updatedAt": "2025-04-14T03:22:58.409Z",
    "media": {
      "id": "1ca728b0-b998-443f-ab22-cff017b99118",
      "title": "teste 2",
      "description": "teste 2",
      "mediaType": "document",
      "type": "upload",
      "url": "https://bucket-clubinho-galeria.s3.amazonaws.com/uploads/1744586575952_Pai Nosso.pdf",
      "isLocalFile": true,
      "originalName": "Pai Nosso.pdf",
      "size": 819942,
      "createdAt": "2025-04-14T03:22:59.201Z",
      "updatedAt": "2025-04-14T03:22:59.201Z"
    }
  }
  ,
  {
    "id": "76b394ed-86ce-498f-b349-677717185646",
    "name": "teste",
    "description": "teste",
    "createdAt": "2025-04-14T03:21:30.213Z",
    "updatedAt": "2025-04-14T03:21:30.213Z",
    "media": {
      "id": "5934d9bc-13d5-4e32-8d6d-4910bbdda736",
      "title": "teste",
      "description": "teste",
      "mediaType": "document",
      "type": "upload",
      "url": "https://bucket-clubinho-galeria.s3.amazonaws.com/uploads/1744586487482_Contrato FUNDAÃÃO MATIAS 2025.pdf",
      "isLocalFile": true,
      "originalName": "Contrato FUNDAÃÃO MATIAS 2025.pdf",
      "size": 796157,
      "createdAt": "2025-04-14T03:21:31.049Z",
      "updatedAt": "2025-04-14T03:21:31.049Z"
    }
  }

]
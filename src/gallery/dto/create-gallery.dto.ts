export class CreateGalleryPageDTO {
    name: string;
    description: string;
    sections: CreateGallerySectionDTO[];
  }
  
  export class CreateGallerySectionDTO {
    caption: string;
    description: string;
    images: CreateGalleryImageDTO[];
  }
  
  export class CreateGalleryImageDTO {
    url?: string;
    isLocalFile: boolean;
    fileFieldName?: string; // Nome do campo do arquivo para imagens locais
  }
import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
    Inject,
  } from '@nestjs/common';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { DocumentRepository } from '../document.repository';
  import { DocumentDto } from '../dto/document-response.dto';
  
  @Injectable()
  export class GetDocumentService {
    private readonly logger = new Logger(GetDocumentService.name);
  
    constructor(
      @Inject(DocumentRepository)
      private readonly documentRepo: DocumentRepository,
      private readonly mediaItemProcessor: MediaItemProcessor,
    ) {}
  
    async findAll(): Promise<DocumentDto[]> {
      const documents = await this.documentRepo.findAllSorted();
    
      if (!documents.length) return [];
    
      const ids = documents.map((d) => d.id);
      const mediaItems = await this.mediaItemProcessor.findManyMediaItemsByTargets(ids, 'document');
    
      const mediaMap = new Map<string, typeof mediaItems[number]>();
      mediaItems.forEach((media) => mediaMap.set(media.targetId, media));
    
      return documents.map((doc) => DocumentDto.fromEntity(doc, mediaMap.get(doc.id)));
    }
    
    async findOne(id: string): Promise<DocumentDto> {
      const doc = await this.documentRepo.findOneById(id);
      if (!doc) throw new NotFoundException('Documento não encontrado');
    
      const media = await this.mediaItemProcessor.findMediaItemsByTarget(id, 'document');
      return DocumentDto.fromEntity(doc, media[0]);
    }
    
  }
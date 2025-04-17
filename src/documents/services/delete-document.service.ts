import {
    Injectable,
    Logger,
    NotFoundException,
    Inject,
  } from '@nestjs/common';
  import { AwsS3Service } from 'src/aws/aws-s3.service';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { DocumentRepository } from '../document.repository';
  
  @Injectable()
  export class DeleteDocumentService {
    private readonly logger = new Logger(DeleteDocumentService.name);
  
    constructor(
      @Inject(DocumentRepository)
      private readonly documentRepo: DocumentRepository,
      private readonly s3Service: AwsS3Service,
      private readonly mediaItemProcessor: MediaItemProcessor,
    ) {}
  
    async execute(id: string): Promise<void> {
      this.logger.log(`🗑️ Removendo documento ID=${id}`);
  
      const document = await this.documentRepo.findOneById(id);
      if (!document) throw new NotFoundException('Documento não encontrado');
  
      const media = await this.mediaItemProcessor.findMediaItemsByTarget(id, 'document');
      if (media.length > 0) {
        await this.mediaItemProcessor.deleteMediaItems(media, this.s3Service.delete.bind(this.s3Service));
        this.logger.log('🧹 Mídia associada removida.');
      }
  
      await this.documentRepo.remove(document);
      this.logger.log('✅ Documento removido.');
    }
  }
import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { ImagePageRepository } from '../repository/image-page.repository';
import { ImagePageResponseDto } from '../dto/image-page-response.dto';

@Injectable()
export class ImagePageGetService {
    private readonly logger = new Logger(ImagePageGetService.name);

    constructor(
        private readonly imagePageRepository: ImagePageRepository,
        private readonly mediaItemProcessor: MediaItemProcessor,
    ) {
        this.logger.debug('🛠️ ImagePageGetService inicializado');
    }

    async findAll(): Promise<ImagePageResponseDto[]> {
        this.logger.log('🚀 Iniciando busca de todas as páginas de imagens');
        this.logger.debug('🔍 Buscando páginas com seções');
        const pages = await this.imagePageRepository.findAllWithSections();
        this.logger.debug(`✅ Encontradas ${pages.length} páginas`);

        const sectionIds = pages.flatMap((page) => page.sections.map((s) => s.id));
        this.logger.debug(`🔍 Buscando mídias para ${sectionIds.length} seções`);
        const mediaItems = await this.mediaItemProcessor.findManyMediaItemsByTargets(sectionIds, 'ImagesPage');
        this.logger.debug(`✅ Encontrados ${mediaItems.length} itens de mídia`);

        const mediaMap = new Map<string, MediaItemEntity[]>();
        for (const item of mediaItems) {
            if (!mediaMap.has(item.targetId)) mediaMap.set(item.targetId, []);
            mediaMap.get(item.targetId)!.push(item);
        }
        this.logger.debug(`📋 Mapa de mídias criado com ${mediaMap.size} entradas`);

        this.logger.debug('📤 Preparando resposta DTO para todas as páginas');
        const result = pages.map((page) => ImagePageResponseDto.fromEntity(page, mediaMap));
        this.logger.log(`✅ Retornando ${result.length} páginas de imagens`);
        return result;
    }

    async findOne(id: string): Promise<ImagePageResponseDto> {
        this.logger.log(`🚀 Iniciando busca de página de imagens com ID: ${id}`);
        this.logger.debug(`🔍 Buscando página com ID: ${id}`);
        const page = await this.imagePageRepository.findByIdWithSections(id);
        if (!page) {
            this.logger.warn(`⚠️ Página com ID ${id} não encontrada`);
            throw new NotFoundException('Página de galeria não encontrada.');
        }
        this.logger.debug(`✅ Página encontrada: ID=${page.id}, name="${page.name}"`);

        if (!page.route) {
            this.logger.warn(`⚠️ Rota não encontrada para página ID: ${id}`);
            throw new NotFoundException(`A galeria com id ${id} não possui rota associada.`);
        }
        this.logger.debug(`✅ Rota validada: ID=${page.route.id}`);

        const sectionIds = page.sections.map((s) => s.id);
        this.logger.debug(`🔍 Buscando mídias para ${sectionIds.length} seções`);
        const media = await this.mediaItemProcessor.findManyMediaItemsByTargets(sectionIds, 'ImagesPage');
        this.logger.debug(`✅ Encontrados ${media.length} itens de mídia`);

        const mediaMap = new Map<string, MediaItemEntity[]>();
        for (const item of media) {
            if (!mediaMap.has(item.targetId)) mediaMap.set(item.targetId, []);
            mediaMap.get(item.targetId)!.push(item);
        }
        this.logger.debug(`📋 Mapa de mídias criado com ${mediaMap.size} entradas`);

        this.logger.debug('📤 Preparando resposta DTO');
        const result = ImagePageResponseDto.fromEntity(page, mediaMap);
        this.logger.log(`✅ Página de imagens retornada com sucesso: ID=${id}`);
        return result;
    }
}

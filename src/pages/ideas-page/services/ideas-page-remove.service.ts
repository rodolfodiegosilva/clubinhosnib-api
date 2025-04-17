// src/pages/ideas-page/services/ideas-page-remove.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';

import { IdeasPageRepository } from '../repositories/ideas-page.repository';

@Injectable()
export class IdeasPageRemoveService {
  private readonly logger = new Logger(IdeasPageRemoveService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly s3: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaProcessor: MediaItemProcessor,
    private readonly pageRepo: IdeasPageRepository,
  ) {}

  /* ────────────────────────────────────────────────────────── */
  /**  🚮  Remove página + rota + mídias (atômico) */
  async removeIdeasPage(id: string): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    this.logger.debug(`▶️  Remoção iniciada | IdeasPage ID=${id}`);

    try {
      /* ----------------------------------------------------------------
       * 1. Valida página e carrega seções + rota
       * -------------------------------------------------------------- */
      const page = await this.pageRepo.findOnePageById(id);
      if (!page) throw new NotFoundException('Página de ideias não encontrada');

      const sectionIds = page.sections.map((s) => s.id);
      this.logger.debug(`🔍 page.sections: ${sectionIds.length}`);

      /* ----------------------------------------------------------------
       * 2. Remove mídias ligadas às seções
       * -------------------------------------------------------------- */
      let removedMedia = 0;
      if (sectionIds.length) {
        const media: MediaItemEntity[] =
          await this.mediaProcessor.findManyMediaItemsByTargets(
            sectionIds,
            MediaTargetType.IdeasSection,
          );

        removedMedia = media.length;
        if (removedMedia) {
          await this.mediaProcessor.deleteMediaItems(
            media,
            this.s3.delete.bind(this.s3),
          );
        }
      }
      this.logger.debug(`🗑️  Mídias removidas: ${removedMedia}`);

      /* ----------------------------------------------------------------
       * 3. Remove rota (se houver)
       * -------------------------------------------------------------- */
      if (page.route?.id) {
        await this.routeService.removeRoute(page.route.id);
        this.logger.debug(`🗑️  Rota ID=${page.route.id} removida`);
      }

      /* ----------------------------------------------------------------
       * 4. Remove página (cascade exclui seções)
       * -------------------------------------------------------------- */
      await this.pageRepo.removePageWithManager(runner.manager, page);
      this.logger.debug(`🗑️  IdeasPage ID=${id} removida`);

      await runner.commitTransaction();
      this.logger.verbose(`✅  Remoção concluída | ID=${id}`);
    } catch (err) {
      await runner.rollbackTransaction();
      this.logger.error('💥  Rollback – erro ao remover página', err.stack);
      throw new BadRequestException(
        `Erro ao remover página de ideias: ${err.message}`,
      );
    } finally {
      await runner.release();
      this.logger.debug('⛔  QueryRunner liberado');
    }
  }
}

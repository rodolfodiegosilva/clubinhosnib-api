import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ImagePageEntity } from '../entity/Image-page.entity';

@Injectable()
export class ImagePageRepository extends Repository<ImagePageEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(ImagePageEntity, dataSource.createEntityManager());
  }

  /**
   * Busca uma galeria por ID com suas seções.
   */
  async findByIdWithSections(id: string): Promise<ImagePageEntity | null> {
    return this.findOne({
      where: { id },
      relations: ['sections'],
    });
  }

  /**
   * Retorna todas as galerias com suas seções.
   */
  async findAllWithSections(): Promise<ImagePageEntity[]> {
    return this.find({
      relations: ['sections'],
      order: { id: 'ASC' },
    });
  }

  /**
   * Upsert: atualiza se tiver ID, cria novo se não tiver.
   * @param data dados da galeria
   */
  async upsertGallery(data: Partial<ImagePageEntity>): Promise<ImagePageEntity> {
    if (data.id) {
      const existing = await this.preload(data);
      if (!existing) {
        throw new Error(`Galeria com id=${data.id} não encontrada para atualização`);
      }
      return this.save(existing);
    }

    const created = this.create(data);
    return this.save(created);
  }
}

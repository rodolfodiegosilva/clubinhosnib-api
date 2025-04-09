import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WeekMaterialsPageEntity } from './entities/week-material-page.entity/week-material-page.entity';

@Injectable()
export class WeekMaterialsPageRepository extends Repository<WeekMaterialsPageEntity> {
  constructor(private dataSource: DataSource) {
    super(WeekMaterialsPageEntity, dataSource.createEntityManager());
  }

  async findAllPages(): Promise<WeekMaterialsPageEntity[]> {
    return this.find({ relations: ['route'] });
  }

  async findOnePageById(id: string): Promise<WeekMaterialsPageEntity | null> {
    return this.findOne({
      where: { id },
      relations: ['route'],
    });
  }

  async savePage(page: WeekMaterialsPageEntity): Promise<WeekMaterialsPageEntity> {
    return this.save(page);
  }

  async removePage(page: WeekMaterialsPageEntity): Promise<WeekMaterialsPageEntity> {
    return this.remove(page);
  }
}

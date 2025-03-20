import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Route } from './route-page.entity';

@Injectable()
export class RouteRepository extends Repository<Route> {
  constructor(private readonly dataSource: DataSource) {
    super(Route, dataSource.createEntityManager());
  }

  async findByPath(path: string): Promise<Route | null> {
    return this.findOne({ where: { path } });
  }

  async findByEntity(entityType: string, entityId: string): Promise<Route | null> {
    return this.findOne({ where: { entityType, entityId } });
  }
}

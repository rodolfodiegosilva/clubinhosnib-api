import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Route } from './route-page.entity';

@Injectable()
export class RouteRepository extends Repository<Route> {
  constructor(private readonly dataSource: DataSource) {
    super(Route, dataSource.createEntityManager());
  }

  async findAllRoutes(): Promise<Route[]> {
    return this.find();
  }

  async findById(id: string): Promise<Route | null> {
    return this.findOne({ where: { id } });
  }

  async removeById(id: string): Promise<void> {
    const route = await this.findOne({ where: { id } });
    if (route) {
      await this.remove(route);
    }
  }

  async findByPath(path: string): Promise<Route | null> {
    return this.findOne({ where: { path } });
  }

  async findByEntity(entityType: string, entityId: string): Promise<Route | null> {
    return this.findOne({ where: { entityType, entityId } });
  }

  async createRoute(path: string, entityType: string, entityId: string, description: string) {
    const route = this.create({
      path,
      entityType,
      entityId,
      description,
    });
    return this.save(route);
  }
}

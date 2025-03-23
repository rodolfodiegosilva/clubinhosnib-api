import { Injectable, Logger } from '@nestjs/common';
import { RouteRepository } from './route-page.repository';
import { Route, RouteType } from './route-page.entity';

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);

  constructor(private readonly routeRepo: RouteRepository) {}

  async checkPathAvailability(path: string): Promise<void> {
    this.logger.debug(`Verificando disponibilidade da rota: ${path}`);
    const existingRoute = await this.routeRepo.findByPath(path);
    if (existingRoute) {
      throw new Error(`⚠️ A rota "${path}" já está em uso!`);
    }
  }

  async createRouteForGallery(path: string, description: string, entityId: string, type: RouteType): Promise<Route> {
    this.logger.debug(`Criando rota para GalleryPage. Path="${path}", entityId="${entityId}"`);
    return this.routeRepo.createRoute(path, 'GalleryPage', entityId, description,type);
  }

  async findAllRoutes(): Promise<Route[]> {
    return this.routeRepo.find();
  }

  async findById(id: string): Promise<Route | null> {
    return this.routeRepo.findOne({ where: { id } });
  }

  async removeRoute(id: string): Promise<void> {
    const route = await this.routeRepo.findOne({ where: { id } });
    if (route) {
      await this.routeRepo.remove(route);
    }
  }
}

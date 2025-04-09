import { Injectable, Logger } from '@nestjs/common';
import { RouteRepository } from './route-page.repository';
import { RouteEntity, RouteType } from './route-page.entity';
import { EntityManager } from 'typeorm';

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);

  constructor(private readonly routeRepo: RouteRepository) { }

  generateRoute(title: string, prefix: string): string {
    const route = (
      prefix +
      title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .trim()
    );
    this.logger.debug(`🔤 Rota gerada para "${title}": ${route}`);
    return route;
  }

  async generateAvailablePath(baseName: string, prefix: string): Promise<string> {
    const basePath = this.generateRoute(baseName, prefix);
    let candidatePath = basePath;
    let suffix = 1;

    while (await this.routeRepo.findByPath(candidatePath)) {
      this.logger.debug(`❌ Caminho já em uso: ${candidatePath}`);
      candidatePath = `${basePath}_${suffix}`;
      suffix++;
    }

    this.logger.debug(`🆗 Path disponível gerado: ${candidatePath}`);
    return candidatePath;
  }

  async createRoute(data: {
    title: string;
    public?: boolean;
    subtitle: string;
    idToFetch: string;
    path?: string;
    entityType: string;
    description: string;
    entityId: string;
    type: RouteType;
    image?: string;
    prefix?: string;
  }): Promise<RouteEntity> {
    const path = data.path || (await this.generateAvailablePath(data.title, data.prefix || ''));
    this.logger.debug(`🛠️ Criando rota para ${data.entityType} com path: "${path}"`);

    const route = new RouteEntity();
    route.title = data.title;
    route.public = data.public || true;
    route.subtitle = data.subtitle;
    route.idToFetch = data.idToFetch;
    route.path = path;
    route.entityType = data.entityType;
    route.description = data.description;
    route.entityId = data.entityId;
    route.type = data.type;
    route.image = data.image || '';

    const savedRoute = await this.routeRepo.save(route);
    this.logger.debug(`✅ Rota criada com sucesso: ID=${savedRoute.id}, path=${savedRoute.path}`);
    return savedRoute;
  }

  async updateRoute(id: string, updateData: Partial<Pick<RouteEntity, 'title' | 'description' | 'path' | 'subtitle'>>): Promise<RouteEntity> {
    this.logger.debug(`✏️ Iniciando atualização da rota ID=${id}`);
    const route = await this.routeRepo.findOne({ where: { id } });
    if (!route) {
      this.logger.warn(`⚠️ Rota não encontrada para ID=${id}`);
      throw new Error('Rota não encontrada para atualização');
    }

    if (updateData.title) {
      route.title = updateData.title;
      this.logger.debug(`📝 Nome da rota atualizado para: ${route.title}`);
    }
    if (updateData.description) {
      route.description = updateData.description;
      this.logger.debug(`📝 Descrição da rota atualizada.`);
    }
    if (updateData.path) {
      const existingRoute = await this.routeRepo.findByPath(updateData.path);
      if (existingRoute && existingRoute.id !== id) {
        this.logger.warn(`⚠️ A rota "${updateData.path}" já está em uso por outra entidade.`);
        throw new Error(`A rota "${updateData.path}" já está em uso!`);
      }
      route.path = updateData.path;
      this.logger.debug(`🛤️ Caminho da rota atualizado para: ${route.path}`);
    }

    const updated = await this.routeRepo.save(route);
    this.logger.debug(`✅ Rota atualizada com sucesso: ID=${updated.id}`);
    return updated;
  }

  async findAllRoutes(): Promise<RouteEntity[]> {
    this.logger.debug(`📄 Buscando todas as rotas no sistema...`);
    return this.routeRepo.find();
  }

  async findById(id: string): Promise<RouteEntity | null> {
    this.logger.debug(`🔍 Buscando rota por ID=${id}`);
    return this.routeRepo.findOne({ where: { id } });
  }

  async removeRoute(id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo rota ID=${id}`);
    const route = await this.routeRepo.findOne({ where: { id } });
    if (route) {
      await this.routeRepo.remove(route);
      this.logger.debug(`✅ Rota removida com sucesso: ID=${id}`);
    } else {
      this.logger.warn(`⚠️ Tentativa de remover rota inexistente ID=${id}`);
    }
  }

  async removeRouteByEntity(entityType: string, entityId: string): Promise<void> {
    this.logger.log(`🗑️ Removendo rota com entityType=${entityType} e entityId=${entityId}`);
    const route = await this.routeRepo.findOne({ where: { entityType, entityId } });
    if (route) {
      await this.routeRepo.remove(route);
      this.logger.log(`✅ Rota removida com sucesso: ID=${route.id}`);
    } else {
      this.logger.warn(`⚠️ Nenhuma rota encontrada para entityType=${entityType} e entityId=${entityId}`);
    }
  }

  async createRouteWithManager(
    manager: EntityManager,
    data: {
      title: string;
      public?: boolean;
      subtitle: string;
      idToFetch: string;
      path: string;
      entityType: string;
      description: string;
      entityId: string;
      type: RouteType;
      image?: string;
    }
  ): Promise<RouteEntity> {
    const route = manager.create(RouteEntity, {
      title: data.title,
      public: data.public ?? true,
      subtitle: data.subtitle,
      idToFetch: data.idToFetch,
      path: data.path,
      entityType: data.entityType,
      description: data.description,
      entityId: data.entityId,
      type: data.type,
      image: data.image || '',
    });

    return await manager.save(route);
  }

  async findRouteByEntityId(entityId: string): Promise<RouteEntity | null> {
    this.logger.debug(`🔍 Buscando rota para entityId=${entityId}`);
    const route = await this.routeRepo.findOne({ where: { entityId } });
    if (!route) {
      this.logger.warn(`⚠️ Nenhuma rota encontrada para entityId=${entityId}`);
    }
    return route;
  }

  async upsertRoute(routeId: string, updateData: Partial<RouteEntity>): Promise<RouteEntity> {
    // Gerar o novo path para a rota
    const path = this.generateRoute(updateData.title || '', updateData.path || '');
    updateData.path = path;
    
    this.logger.debug(`🛠️ Iniciando upsert da rota ID=${routeId} com path: "${path}"`);
    
    // Chama o upsert do repositório
    return this.routeRepo.upsertRoute(routeId, updateData);
  }
  

}
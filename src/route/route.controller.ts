import {
  Controller,
  Get,
  Delete,
  Param,
  Logger,
} from '@nestjs/common';
import { RouteService } from './route.service';
import { Route } from './route-page.entity';

@Controller('routes')
export class RouteController {
  private readonly logger = new Logger(RouteController.name);

  constructor(private readonly routeService: RouteService) {}

  @Get()
  async findAll(): Promise<Route[]> {
    this.logger.debug('Buscando todas as rotas...');
    const routes = await this.routeService.findAllRoutes();
    this.logger.debug(`Total de rotas encontradas: ${routes.length}`);
    return routes;
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Route | null> {
    this.logger.debug(`Buscando rota com ID=${id}`);
    const route = await this.routeService.findById(id);
    if (!route) {
      this.logger.warn(`Rota ID=${id} não encontrada.`);
    }
    return route;
  }

  @Delete(':id')
  async removeRoute(@Param('id') id: string) {
    this.logger.debug(`Removendo rota com ID=${id}...`);
    await this.routeService.removeRoute(id);
    this.logger.debug(`Rota ID=${id} removida com sucesso.`);
    return { message: `Rota ID=${id} removida com sucesso` };
  }
}

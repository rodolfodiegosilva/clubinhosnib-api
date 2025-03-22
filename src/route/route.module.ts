import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from './route-page.entity';
import { RouteRepository } from './route-page.repository';
import { DataSource } from 'typeorm';
import { RouteService } from './route.service';

@Module({
  imports: [TypeOrmModule.forFeature([Route])],
  providers: [
    RouteService,
    {
      provide: RouteRepository,
      useFactory: (dataSource: DataSource) => new RouteRepository(dataSource),
      inject: [DataSource],
    },
  ],
  exports: [RouteService, RouteRepository],
})
export class RouteModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { MeditationController } from './meditation.controller';
import { MeditationService } from './meditation.service';
import { MeditationRepository } from './meditation.repository';

import { MeditationEntity } from './entities/meditation.entity';
import { DayEntity } from './entities/day.entity'; // Importa o módulo, não o serviço diretamente
import { RouteModule } from 'src/route/route.module';
import { MediaModule } from 'src/share/media/media.module';
import { CreateMeditationService } from './services/create-meditation.service';
import { UpdateMeditationService } from './services/update-meditation.service';
import { DeleteMeditationService } from './services/delete-meditation.service';
import { GetMeditationService } from './services/get-meditation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MeditationEntity, DayEntity]),
    RouteModule,
    MediaModule
  ],
  controllers: [MeditationController],
  providers: [
    MeditationService,
    CreateMeditationService,
    UpdateMeditationService,
    DeleteMeditationService,
    GetMeditationService,
    {
      provide: 'MeditationRepository',
      useFactory: (dataSource: DataSource) => new MeditationRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: MeditationRepository,
      useFactory: (dataSource: DataSource) => new MeditationRepository(dataSource),
      inject: [DataSource],
    },
  ],
  exports: [MeditationService],
})
export class MeditationModule {}

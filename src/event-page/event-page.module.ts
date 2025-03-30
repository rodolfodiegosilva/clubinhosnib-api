import { Module } from '@nestjs/common';
import { EventPageController } from './event-page.controller';
import { EventPageService } from './event-page.service';

@Module({
  controllers: [EventPageController],
  providers: [EventPageService]
})
export class EventPageModule {}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  HttpCode,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MeditationService } from './meditation.service';
import { UpdateMeditationDto } from './dto/update-meditation.dto';
import { MeditationEntity } from './entities/meditation.entity';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { CreateMeditationDto } from './dto/create-meditation.dto';
import { WeekMeditationResponseDto } from './dto/week-meditation-response-dto';

@Controller('meditations')
export class MeditationController {
  constructor(private readonly meditationService: MeditationService) { }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('meditationData') meditationDataRaw: string
  ): Promise<MeditationEntity> {
    try {
      const parsed = JSON.parse(meditationDataRaw);
      const dto = plainToInstance(CreateMeditationDto, parsed);

      await validateOrReject(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      return this.meditationService.create(dto, file);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Array ? error.map(e => Object.values(e.constraints)).flat().join('; ') : error.message,
      );
    }
  }

  @Get()
  async findAll(): Promise<WeekMeditationResponseDto[]> {
    return this.meditationService.findAll();
  }
  


  @Get('/this-week')
  async getThisWeekMeditation(): Promise<WeekMeditationResponseDto> {
    return this.meditationService.getThisWeekMeditation();
  }



  @Get(':id')
  findOne(@Param('id') id: string): Promise<MeditationEntity> {
    return this.meditationService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMeditationDto): Promise<MeditationEntity> {
    return this.meditationService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.meditationService.remove(id);
  }
}

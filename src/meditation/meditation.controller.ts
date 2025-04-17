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
import { CreateMeditationService } from './services/create-meditation.service';
import { UpdateMeditationService } from './services/update-meditation.service';
import { DeleteMeditationService } from './services/delete-meditation.service';
import { GetMeditationService } from './services/get-meditation.service';
import { UpdateMeditationDto } from './dto/update-meditation.dto';
import { MeditationEntity } from './entities/meditation.entity';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { CreateMeditationDto } from './dto/create-meditation.dto';
import { WeekMeditationResponseDto } from './dto/week-meditation-response-dto';

@Controller('meditations')
export class MeditationController {
  constructor(
    private readonly createMeditationService: CreateMeditationService,
    private readonly updateMeditationService: UpdateMeditationService,
    private readonly deleteMeditationService: DeleteMeditationService,
    private readonly getMeditationService: GetMeditationService,
  ) {}

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

      return this.createMeditationService.create(dto, file);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Array ? error.map(e => Object.values(e.constraints)).flat().join('; ') : error.message,
      );
    }
  }

  @Get()
  async findAll(): Promise<WeekMeditationResponseDto[]> {
    return this.getMeditationService.findAll();
  }

  @Get('/this-week')
  async getThisWeekMeditation(): Promise<WeekMeditationResponseDto> {
    return this.getMeditationService.getThisWeekMeditation();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<MeditationEntity> {
    return this.getMeditationService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMeditationDto): Promise<MeditationEntity> {
    return this.updateMeditationService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.deleteMeditationService.remove(id);
  }
}
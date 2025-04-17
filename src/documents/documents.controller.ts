import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
  Logger
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

import { CreateDocumentService } from './services/create-document.service';
import { UpdateDocumentService } from './services/update-document.service';
import { GetDocumentService } from './services/get-document.service';
import { DeleteDocumentService } from './services/delete-document.service';

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly createService: CreateDocumentService,
    private readonly updateService: UpdateDocumentService,
    private readonly getService: GetDocumentService,
    private readonly deleteService: DeleteDocumentService,
  ) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor()) // para nomes de arquivo dinâmicos
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('documentData') documentDataRaw?: string,
  ) {
    this.logger.log('=== [POST /documents] Iniciando criação de documento ===');

    // Log dos arquivos recebidos
    if (!files) {
      this.logger.warn('files está undefined!');
    } else {
      this.logger.debug(`files é um array? ${Array.isArray(files)}`);
      this.logger.debug(`Quantidade de arquivos: ${files.length}`);
      for (const f of files) {
        this.logger.debug(` - fieldname: ${f.fieldname}, originalname: ${f.originalname}`);
      }
    }

    this.logger.debug('documentDataRaw recebido: ' + documentDataRaw);

    if (!documentDataRaw) {
      this.logger.error('Campo "documentData" não enviado.');
      throw new BadRequestException('Campo "documentData" não enviado.');
    }

    let dto: CreateDocumentDto;
    try {
      const parsed = JSON.parse(documentDataRaw);
      this.logger.debug('documentDataRaw parseado: ' + JSON.stringify(parsed, null, 2));

      dto = plainToInstance(CreateDocumentDto, parsed);
      this.logger.debug('DTO após class-transformer:' + JSON.stringify(dto, null, 2));

      await validateOrReject(dto);
    } catch (err) {
      this.logger.error('Erro ao processar/validar DTO:', err);
      throw new BadRequestException('Erro ao processar dados do documento.');
    }

    // Se o DTO tiver algo como dto.media.fileField = "doc-0"
    // Precisamos buscar no array `files` o arquivo cujo fieldname combine:
    let file: Express.Multer.File | undefined;
    if (dto.media?.fileField) {
      this.logger.debug(`Buscando arquivo com fieldname: "${dto.media.fileField}"`);
      if (!files || !Array.isArray(files)) {
        this.logger.error('files está undefined ou não é um array');
      } else {
        file = files.find((f) => f.fieldname === dto.media.fileField);
      }
    }

    this.logger.debug('Arquivo encontrado com base em fileField? ' + (file ? 'SIM' : 'NÃO'));

    const result = await this.createService.execute(dto, file);
    this.logger.log('=== [POST /documents] Fim da criação de documento ===\n');

    return result;
  }

  @Get()
  findAll() {
    this.logger.log('=== [GET /documents] Listando documentos ===');
    return this.getService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`=== [GET /documents/${id}] Buscando documento ===`);
    return this.getService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('documentData') documentDataRaw?: string,
  ) {
    this.logger.log(`=== [PATCH /documents/${id}] Iniciando atualização de documento ===`);
  
    if (!documentDataRaw) {
      this.logger.error('Campo "documentData" não enviado.');
      throw new BadRequestException('Campo "documentData" não enviado.');
    }
  
    let dto: UpdateDocumentDto; // Declaramos aqui fora
  
    try {
      const parsed = JSON.parse(documentDataRaw);
      this.logger.debug('documentDataRaw parseado:\n' + JSON.stringify(parsed, null, 2));
  
      dto = plainToInstance(UpdateDocumentDto, parsed);
      dto.id = id;
      this.logger.debug('DTO após class-transformer:\n' + JSON.stringify(dto, null, 2));
  
      await validateOrReject(dto);
    } catch (err) {
      this.logger.error('Erro ao processar/validar DTO:', err);
      throw new BadRequestException('Erro ao processar dados do documento.');
    }
  
    // A partir daqui, dto definitivamente existe e está válido
  
    this.logger.debug(`Quantidade de arquivos no array: ${files?.length || 0}`);
    let file: Express.Multer.File | undefined;
  
    // Se dto.media.fileField existir e tivermos algum arquivo, tentamos achar
    if (dto.media?.fileField && Array.isArray(files)) {
      file = files.find((f) => f.fieldname === dto.media.fileField);
      this.logger.debug(
        file
          ? `Arquivo encontrado para fieldname "${dto.media.fileField}": ${file.originalname}`
          : `Nenhum arquivo encontrado para fieldname "${dto.media.fileField}"`,
      );
    }
  
    return this.updateService.execute(id, dto, file);
  }
  

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`=== [DELETE /documents/${id}] Deletando documento ===`);
    return this.deleteService.execute(id);
  }
}

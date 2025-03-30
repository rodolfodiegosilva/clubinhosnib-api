import {
    Entity,
    PrimaryColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { v4 as uuidv4 } from 'uuid';
import { StudyMaterialsPage } from '../study-material-page.entity/study-material-page.entity';
  
  export enum StudyMediaType {
    VIDEO = 'video',
    DOCUMENT = 'document',
    IMAGE = 'image',
    AUDIO = 'audio',
  }
  
  export enum StudyMediaUploadType {
    LINK = 'link',
    UPLOAD = 'upload',
  }
  
  export enum StudyMediaPlatform {
    YOUTUBE = 'youtube',
    GOOGLE_DRIVE = 'google-drive',
    ONEDRIVE = 'onedrive',
    DROPBOX = 'dropbox',
  }
  
  @Entity('study_media_items')
  export class StudyMediaItem {
    @PrimaryColumn()
    id: string;
  
    @Column()
    title: string;
  
    @Column({ type: 'text' })
    description: string;
  
    @Column({
      type: 'enum',
      enum: StudyMediaType,
    })
    mediaType: StudyMediaType;
  
    @Column({
      type: 'enum',
      enum: StudyMediaUploadType,
    })
    type: StudyMediaUploadType;
  
    @Column({
      type: 'enum',
      enum: StudyMediaPlatform,
      nullable: true,
    })
    platform?: StudyMediaPlatform;
  
    @Column()
    url: string;
  
    @Column({ default: false })
    isLocalFile: boolean;
  
    @Column({ nullable: true })
    originalName?: string;
  
    @Column({ nullable: true })
    size?: number;
  
    @ManyToOne(() => StudyMaterialsPage, (page) => page.mediaItems, {
      onDelete: 'CASCADE',
    })
    page: StudyMaterialsPage;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  
    constructor() {
      if (!this.id) this.id = uuidv4();
    }
  }
  
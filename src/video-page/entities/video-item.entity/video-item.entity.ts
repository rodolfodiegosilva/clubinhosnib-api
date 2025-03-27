import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VideosPage } from '../video-page.entity/video-page.entity';

export enum VideoType {
  LINK = 'link',
  UPLOAD = 'upload',
}

export enum VideoPlatform {
  YOUTUBE = 'youtube',
  GOOGLE_DRIVE = 'google-drive',
  ONEDRIVE = 'onedrive',
}

@Entity('video_items')
export class VideoItem {
  @PrimaryColumn()
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: VideoType,
    default: VideoType.LINK,
  })
  type: VideoType;

  @Column({
    type: 'enum',
    enum: VideoPlatform,
    nullable: true,
  })
  platform?: VideoPlatform;

  @Column()
  url: string;

  @Column({ default: false })
  isLocalFile: boolean;

  @Column({ nullable: true })
  originalName?: string;

  @Column({ nullable: true })
  size?: number;

  @ManyToOne(() => VideosPage, (page) => page.videos, { onDelete: 'CASCADE' })
  page: VideosPage;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}

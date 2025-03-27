import { Route } from 'src/route/route-page.entity';
import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VideoItem } from '../video-item.entity/video-item.entity';

@Entity('videos_pages')
export class VideosPage {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string; // Título da página

  @Column({ type: 'text' })
  description: string; // Descrição da página

  @OneToOne(() => Route, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  route: Route;

  @OneToMany(() => VideoItem, (video) => video.page, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  videos: VideoItem[];

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

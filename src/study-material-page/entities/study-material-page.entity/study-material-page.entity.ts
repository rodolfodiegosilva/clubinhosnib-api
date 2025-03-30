export class StudyMaterialPageEntity {}
import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Route } from 'src/route/route-page.entity';
import { StudyMediaItem } from '../study-media-item/StudyMediaItem';

@Entity('study_materials_pages')
export class StudyMaterialsPage {
  @PrimaryColumn()
  id: string;

  @Column()
  title: string;

  @Column()
  subtitle: string;

  @Column({ type: 'text' })
  description: string;

  @OneToOne(() => Route, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  route: Route;

  @OneToMany(() => StudyMediaItem, (item) => item.page, {
    cascade: true,
    eager: true,
  })
  mediaItems: StudyMediaItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor() {
    if (!this.id) this.id = uuidv4();
  }
}

import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { GallerySection } from './gallery-section.entity';
import { Route } from '../route/route-page.entity';

@Entity('gallery_pages')
export class GalleryPage {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  // Associação com a rota da página - cascade e exclusão em cascata
  @OneToOne(() => Route, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  route: Route;

  // Seções da galeria (e suas imagens) são removidas em cascata
  @OneToMany(() => GallerySection, (section) => section.page, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  sections: GallerySection[];

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

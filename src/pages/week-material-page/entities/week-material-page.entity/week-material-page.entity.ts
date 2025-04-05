import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { RouteEntity } from 'src/route/route-page.entity';
import { BaseEntity } from 'src/share/share-entity/base.entity';

@Entity('week_material_pages')
export class WeekMaterialsPageEntity extends BaseEntity {
  @Column()
  title: string;

  @Column()
  subtitle: string;

  @Column({ type: 'text' })
  description: string;

  @OneToOne(() => RouteEntity, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  route: RouteEntity;

  // ❌ A relação com `WeekMediaItem` foi removida
  // ✅ Os itens agora são acessados por query com base em targetId/targetType
}

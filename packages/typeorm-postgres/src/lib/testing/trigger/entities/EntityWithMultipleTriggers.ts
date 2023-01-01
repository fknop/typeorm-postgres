import {Entity, PrimaryGeneratedColumn} from 'typeorm'
import {PostgresTrigger} from '../../../decorators/PostgresTrigger'
import {FunctionForTrigger} from '../functions/FunctionForTrigger'

@PostgresTrigger({
  name: 'prevent_update_entity',
  when: 'BEFORE',
  event: ['UPDATE'],
  execute: () => FunctionForTrigger,
})
@PostgresTrigger({
  name: 'prevent_update_entity_2',
  when: 'BEFORE',
  event: ['UPDATE'],
  execute: 'prevent_update()',
})
@Entity()
export class EntityWithMultipleTriggers {
  @PrimaryGeneratedColumn('uuid')
  id!: string
}

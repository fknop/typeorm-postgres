import {Entity, PrimaryGeneratedColumn} from 'typeorm'
import {PostgresTrigger} from '../../../decorators/PostgresTrigger'
import {FunctionForTrigger} from '../functions/FunctionForTrigger'

@PostgresTrigger({
  name: 'prevent_update_entity',
  when: 'BEFORE',
  event: ['UPDATE'],
  execute: () => FunctionForTrigger,
})
@Entity()
export class EntityWithTrigger {
  @PrimaryGeneratedColumn('uuid')
  id!: string
}

import {PostgresSequence} from '../../../decorators/PostgresSequence'

@PostgresSequence({
  increment: 1,
  name: 'sequence_one',
  minValue: 1,
  start: 1,
  dataType: 'bigint',
})
export class SequenceOne {}

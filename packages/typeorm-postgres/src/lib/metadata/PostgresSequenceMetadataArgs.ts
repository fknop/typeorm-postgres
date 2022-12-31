import {PostgresSequenceOptions} from '../options/PostgresSequenceOptions'

export interface PostgresSequenceMetadataArgs {
  target: string | Function
  options: PostgresSequenceOptions
}

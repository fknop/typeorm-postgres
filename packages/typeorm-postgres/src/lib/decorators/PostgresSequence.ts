import {getPostgresMetadataArgsStorage} from '../metadata/TypeormPostgresArgsMetadata'
import {PostgresSequenceOptions} from '../options/PostgresSequenceOptions'

export function PostgresSequence(
  options: PostgresSequenceOptions
): ClassDecorator {
  return function (target) {
    // This is using TypeORM storage for now, but could leverage extension specific storage instead
    getPostgresMetadataArgsStorage().sequences.push({
      target,
      options,
    })
  }
}

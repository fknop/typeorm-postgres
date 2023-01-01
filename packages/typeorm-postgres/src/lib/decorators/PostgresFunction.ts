import {getPostgresMetadataArgsStorage} from '../metadata/TypeormPostgresArgsMetadata'
import {PostgresFunctionOptions} from '../options/PostgresFunctionOptions'

export function PostgresFunction<T extends string>(
  options: PostgresFunctionOptions<T>
): ClassDecorator {
  return function (target) {
    // This is using TypeORM storage for now, but could leverage extension specific storage instead
    getPostgresMetadataArgsStorage().functions.push({
      target,
      options,
    })
  }
}

import {getPostgresMetadataArgsStorage} from '../metadata/TypeormPostgresArgsMetadata'
import {PostgresTriggerOptions} from '../options/PostgresTriggerOptions'

export function PostgresTrigger(
  options: PostgresTriggerOptions
): ClassDecorator {
  return function (target) {
    // This is using TypeORM storage for now, but could leverage extension specific storage instead
    getPostgresMetadataArgsStorage().triggers.push({
      target,
      options,
    })
  }
}

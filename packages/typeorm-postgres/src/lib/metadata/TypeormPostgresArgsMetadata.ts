import {PostgresSequenceMetadataArgs} from './PostgresSequenceMetadataArgs'
import {PostgresFunctionMetadataArgs} from './PostgresFunctionMetadataArgs'
import {PostgresTriggerMetadataArgs} from './PostgresTriggerMetadataArgs'

export class PostgresArgsStorage {
  readonly sequences: PostgresSequenceMetadataArgs[] = []
  readonly functions: PostgresFunctionMetadataArgs[] = []
  readonly triggers: PostgresTriggerMetadataArgs[] = []

  filterSequences(target: Function): PostgresSequenceMetadataArgs | undefined {
    return this.filterTarget(this.sequences, target)
  }

  filterFunctions(target: Function): PostgresFunctionMetadataArgs | undefined {
    return this.filterTarget(this.functions, target)
  }

  filterTriggers(target: Function): PostgresTriggerMetadataArgs | undefined {
    return this.filterTarget(this.triggers, target)
  }

  private filterTarget<T extends {target: string | Function}>(
    list: T[],
    target: Function
  ): T {
    const result = list.filter((sequence) => sequence.target === target)

    if (result.length > 1) {
      throw new Error(`${target.name} is registered multiple times`)
    }

    return result[0]
  }
}

// Following a similar pattern than TypeORM
export function getPostgresMetadataArgsStorage(): PostgresArgsStorage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalScope: any = global
  if (!globalScope.typeormPostgresMetadataArgsStorage)
    globalScope.typeormPostgresMetadataArgsStorage = new PostgresArgsStorage()

  return globalScope.typeormPostgresMetadataArgsStorage
}

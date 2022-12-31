import {PostgresSequenceMetadataArgs} from './PostgresSequenceMetadataArgs'

export class PostgresArgsStorage {
  readonly sequences: PostgresSequenceMetadataArgs[] = []

  filterSequences(target: Function) {
    return this.sequences.filter((sequence) => sequence.target === target)
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

import {EntityMetadata, QueryRunner, RdbmsSchemaBuilderHook} from 'typeorm'
import {SqlInMemory} from 'typeorm/driver/SqlInMemory'
import {Query} from 'typeorm/driver/Query'
import {RdbmsSchemaBuilder} from 'typeorm/schema-builder/RdbmsSchemaBuilder'
import {PostgresQueryRunner} from 'typeorm/driver/postgres/PostgresQueryRunner'
import {getPostgresMetadataArgsStorage} from '../metadata/TypeormPostgresArgsMetadata'
import {
  PostgresSequenceOptions,
  SequenceDataType,
} from '../options/PostgresSequenceOptions'
import {isNil} from '../utils/isNil'

interface DatabaseSequenceRow {
  sequence_schema: string
  sequence_name: string
  data_type: SequenceDataType
  numeric_precision: string
  numeric_precision_radix: string
  start_value: string
  minimum_value: string
  maximum_value: string
  increment: string
  cycle: 'YES' | 'NO'
}

const METADATA_TYPE = 'POSTGRES_SEQUENCE'

export class PostgresSequenceExtension {
  static init({sequences}: {sequences: Function[]}): RdbmsSchemaBuilderHook {
    class PostgresExtension implements RdbmsSchemaBuilderHook {
      private existingSequences: WeakMap<
        RdbmsSchemaBuilder,
        PostgresSequenceOptions[]
      > = new WeakMap()

      private metadataTable = 'typeorm_metadata'

      async init(
        queryRunner: PostgresQueryRunner,
        schemaBuilder: RdbmsSchemaBuilder,
        entityMetadata: EntityMetadata[]
      ): Promise<void> {
        this.metadataTable = queryRunner.getTypeormMetadataTableName()

        this.existingSequences.set(
          schemaBuilder,
          await this.getCurrentSequences(queryRunner)
        )

        return Promise.resolve()
      }

      beforeAll(
        queryRunner: PostgresQueryRunner,
        schemaBuilder: RdbmsSchemaBuilder,
        entityMetadata: EntityMetadata[]
      ): Promise<SqlInMemory> {
        const sqlInMemory = new SqlInMemory()

        const args = getPostgresMetadataArgsStorage()
        const sequencesToSync: PostgresSequenceOptions[] = []

        sequences?.forEach((sequence) => {
          const sequenceToSync = args.filterSequences(sequence)

          if (sequenceToSync.length > 1) {
            throw new Error(`${sequence.name} is registered multiple times`)
          }

          if (sequenceToSync[0]) {
            sequencesToSync.push(sequenceToSync[0].options)
          }
        })

        const existingSequences =
          this.existingSequences.get(schemaBuilder) ?? []
        const sequenceQueries = this.getSequencesQueries(queryRunner, {
          existingSequences,
          sequencesToSync,
        })

        sqlInMemory.upQueries.push(...sequenceQueries.upQueries)
        sqlInMemory.downQueries.push(...sequenceQueries.downQueries)

        return Promise.resolve(sqlInMemory)
      }

      afterAll(
        queryRunner: QueryRunner,
        schemaBuilder: RdbmsSchemaBuilder,
        entityMetadata: EntityMetadata[]
      ): Promise<SqlInMemory> {
        return Promise.resolve({upQueries: [], downQueries: []})
      }

      /**
       * We're getting the current sequences inside the databases
       * We cannot simply rely on the "information_schema"."sequences" table because some sequences might not be managed by this extension
       * We use the typeorm metadata table to store whether we're managing a sequence
       */
      private async getCurrentSequences(
        queryRunner: PostgresQueryRunner
      ): Promise<PostgresSequenceOptions[]> {
        const allSequences: DatabaseSequenceRow[] = await queryRunner.query(
          `SELECT * FROM "information_schema"."sequences"`
        )

        const hasTable = await queryRunner.hasTable(this.metadataTable)

        if (!hasTable) {
          return []
        }

        const qb = await queryRunner.connection.createQueryBuilder()

        qb.select()
          .from(this.metadataTable, 't')
          .where(`${qb.escape('type')} = :type`, {
            type: METADATA_TYPE,
          })

        const metadatas: {name: string; value: string}[] = await qb.getRawMany()

        const databaseSequences = allSequences.map(
          (metadata) => metadata.sequence_name
        )

        return metadatas
          .map((metadata) => {
            return JSON.parse(metadata.value) as PostgresSequenceOptions
          })
          .filter((sequence) => databaseSequences.includes(sequence.name))
      }

      // Keep track of sequences managed by the extension
      private getSequencesQueries(
        queryRunner: PostgresQueryRunner,
        {
          existingSequences,
          sequencesToSync,
        }: {
          existingSequences: PostgresSequenceOptions[]
          sequencesToSync: PostgresSequenceOptions[]
        }
      ): SqlInMemory {
        const sqlInMemory = new SqlInMemory()

        const sequencesToDrop: PostgresSequenceOptions[] = []
        const sequencesToCreate: PostgresSequenceOptions[] = []
        const sequencesToUpdate: {
          old: PostgresSequenceOptions
          new: PostgresSequenceOptions
        }[] = []

        existingSequences.forEach((sequence) => {
          const sequenceToSync = sequencesToSync.find(
            (sequenceToSync) => sequence.name === sequenceToSync.name
          )
          if (!sequenceToSync) {
            sequencesToDrop.push(sequence)
          } else if (this.isUpdatedSequence(sequence, sequenceToSync)) {
            sequencesToUpdate.push({
              old: sequence,
              new: sequenceToSync,
            })
          }
        })

        sequencesToSync.forEach((sequenceToSync) => {
          if (
            !existingSequences.find(
              (sequence) => sequence.name === sequenceToSync.name
            )
          ) {
            sequencesToCreate.push(sequenceToSync)
          }
        })

        sequencesToDrop.forEach((sequence) => {
          sqlInMemory.upQueries.push(this.getDropSequenceQuery(sequence))
          sqlInMemory.downQueries.push(this.getCreateSequenceQuery(sequence))

          sqlInMemory.upQueries.push(
            queryRunner.deleteTypeormMetadataSql({
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              name: sequence.name,
            })
          )
          sqlInMemory.downQueries.push(
            queryRunner.insertTypeormMetadataSql({
              name: sequence.name,
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              value: JSON.stringify(sequence),
            })
          )
        })

        sequencesToCreate.forEach((sequence) => {
          sqlInMemory.upQueries.push(this.getCreateSequenceQuery(sequence))
          sqlInMemory.downQueries.push(this.getDropSequenceQuery(sequence))

          sqlInMemory.upQueries.push(
            queryRunner.insertTypeormMetadataSql({
              name: sequence.name,
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              value: JSON.stringify(sequence),
            })
          )
          sqlInMemory.downQueries.push(
            queryRunner.deleteTypeormMetadataSql({
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              name: sequence.name,
            })
          )
        })

        sequencesToUpdate.forEach((sequence) => {
          sqlInMemory.upQueries.push(this.getAlterSequenceQuery(sequence.new))
          sqlInMemory.downQueries.push(this.getAlterSequenceQuery(sequence.old))
        })

        return sqlInMemory
      }

      private getCreateSequenceQuery(sequence: PostgresSequenceOptions) {
        return new Query(
          `CREATE SEQUENCE "${sequence.name}"${this.getSequenceParameters(
            sequence
          )}`
        )
      }

      private getAlterSequenceQuery(sequence: PostgresSequenceOptions) {
        return new Query(
          `ALTER SEQUENCE "${sequence.name}"${this.getSequenceParameters(
            sequence
          )}`
        )
      }

      private getSequenceParameters(sequence: PostgresSequenceOptions) {
        return ` AS ${sequence.dataType}${sequence.cycle ? ' CYCLE' : ''}${
          !isNil(sequence.start) ? ` START ${sequence.start}` : ''
        }${!isNil(sequence.minValue) ? ` MINVALUE ${sequence.minValue}` : ''}${
          !isNil(sequence.maxValue) ? ` MAXVALUE ${sequence.maxValue}` : ''
        }${sequence.increment ? ` INCREMENT ${sequence.increment}` : ''}`
      }

      private getDropSequenceQuery(sequence: PostgresSequenceOptions) {
        return new Query(`DROP SEQUENCE IF EXISTS "${sequence.name}"`)
      }

      private isUpdatedSequence(
        a: PostgresSequenceOptions,
        b: PostgresSequenceOptions
      ) {
        return (
          a.cycle !== b.cycle ||
          // Using double equal instead of triple because of number/bigint comparisons
          a.start != b.start ||
          a.minValue != b.minValue ||
          a.maxValue != b.maxValue ||
          a.increment != b.increment
        )
      }
    }

    return new PostgresExtension()
  }
}

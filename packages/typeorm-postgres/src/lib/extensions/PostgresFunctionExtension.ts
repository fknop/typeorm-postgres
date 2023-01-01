import {RdbmsSchemaBuilderHook} from 'typeorm'

// These imports are not ideal, if TypeORM decide to change the locations of these files, it will not work anymore
import {SqlInMemory} from 'typeorm/driver/SqlInMemory'
import {Query} from 'typeorm/driver/Query'
import {RdbmsSchemaBuilder} from 'typeorm/schema-builder/RdbmsSchemaBuilder'
import {PostgresQueryRunner} from 'typeorm/driver/postgres/PostgresQueryRunner'

import {getPostgresMetadataArgsStorage} from '../metadata/TypeormPostgresArgsMetadata'
import {PostgresFunctionOptions} from '../options/PostgresFunctionOptions'

const METADATA_TYPE = 'POSTGRES_FUNCTION'

export class PostgresFunctionExtension {
  static register({
    functions,
  }: {
    functions: Function[]
  }): RdbmsSchemaBuilderHook {
    class PostgresExtension implements RdbmsSchemaBuilderHook {
      private existingFunctions: WeakMap<
        RdbmsSchemaBuilder,
        PostgresFunctionOptions<string>[]
      > = new WeakMap()

      private metadataTable = 'typeorm_metadata'

      async init(
        queryRunner: PostgresQueryRunner,
        schemaBuilder: RdbmsSchemaBuilder
      ): Promise<void> {
        this.metadataTable = queryRunner.getTypeormMetadataTableName()

        this.existingFunctions.set(
          schemaBuilder,
          await this.getCurrentFunctions(queryRunner)
        )
      }

      beforeAll(
        queryRunner: PostgresQueryRunner,
        schemaBuilder: RdbmsSchemaBuilder
      ): Promise<SqlInMemory> {
        const sqlInMemory = new SqlInMemory()

        const args = getPostgresMetadataArgsStorage()
        const functionsToSync: PostgresFunctionOptions<string>[] = []

        functions?.forEach((func) => {
          const functionToSync = args.filterFunctions(func)

          if (functionToSync) {
            functionsToSync.push(functionToSync.options)
          }
        })

        const existingFunctions =
          this.existingFunctions.get(schemaBuilder) ?? []

        const functionsQueries = this.getFunctionsQueries(queryRunner, {
          existingFunctions,
          functionsToSync,
        })

        sqlInMemory.upQueries.push(...functionsQueries.upQueries)
        sqlInMemory.downQueries.push(...functionsQueries.downQueries)

        return Promise.resolve(sqlInMemory)
      }

      private async getCurrentFunctions(
        queryRunner: PostgresQueryRunner
      ): Promise<PostgresFunctionOptions<string>[]> {
        const hasTable = await queryRunner.hasTable(this.metadataTable)

        if (!hasTable) {
          return []
        }

        const qb = await queryRunner.connection.createQueryBuilder()

        const metadatas: {name: string; value: string}[] = await qb
          .select()
          .from(this.metadataTable, 't')
          .where(`type = :type`, {
            type: METADATA_TYPE,
          })
          .getRawMany()

        return metadatas.map((metadata) => {
          // Might need to handle this a little better
          return {
            name: metadata.name,
            definition: metadata.value,
          } as PostgresFunctionOptions<string>
        })
      }

      private getFunctionsQueries(
        queryRunner: PostgresQueryRunner,
        {
          existingFunctions,
          functionsToSync,
        }: {
          existingFunctions: PostgresFunctionOptions<string>[]
          functionsToSync: PostgresFunctionOptions<string>[]
        }
      ): SqlInMemory {
        const sqlInMemory = new SqlInMemory()

        const functionsToDrop: PostgresFunctionOptions<string>[] = []
        const functionToCreate: PostgresFunctionOptions<string>[] = []
        const functionsToUpdate: {
          old: PostgresFunctionOptions<string>
          new: PostgresFunctionOptions<string>
        }[] = []

        existingFunctions.forEach((existingFunction) => {
          const functionToSync = functionsToSync.find(
            (functionToSync) => existingFunction.name === functionToSync.name
          )

          if (!functionToSync) {
            functionsToDrop.push(existingFunction)
          } else if (this.isUpdatedFunction(existingFunction, functionToSync)) {
            functionsToUpdate.push({
              old: existingFunction,
              new: functionToSync,
            })
          }
        })

        functionsToSync.forEach((functionToSync) => {
          if (
            !existingFunctions.find((func) => func.name === functionToSync.name)
          ) {
            functionToCreate.push(functionToSync)
          }
        })

        functionsToDrop.forEach((functionToDrop) => {
          sqlInMemory.upQueries.push(this.getDropFunctionQuery(functionToDrop))
          sqlInMemory.downQueries.push(
            this.getCreateFunctionQuery(functionToDrop)
          )

          sqlInMemory.upQueries.push(
            queryRunner.deleteTypeormMetadataSql({
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              name: functionToDrop.name,
            })
          )
          sqlInMemory.downQueries.push(
            queryRunner.insertTypeormMetadataSql({
              name: functionToDrop.name,
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              value: functionToDrop.definition,
            })
          )
        })

        functionToCreate.forEach((functionToCreate) => {
          sqlInMemory.upQueries.push(
            this.getCreateFunctionQuery(functionToCreate)
          )
          sqlInMemory.downQueries.push(
            this.getDropFunctionQuery(functionToCreate)
          )

          sqlInMemory.upQueries.push(
            queryRunner.insertTypeormMetadataSql({
              name: functionToCreate.name,
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              value: functionToCreate.definition,
            })
          )
          sqlInMemory.downQueries.push(
            queryRunner.deleteTypeormMetadataSql({
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              name: functionToCreate.name,
            })
          )
        })

        functionsToUpdate.forEach((func) => {
          sqlInMemory.upQueries.push(this.getCreateFunctionQuery(func.new))
          sqlInMemory.downQueries.push(this.getCreateFunctionQuery(func.old))
        })

        return sqlInMemory
      }

      private getCreateFunctionQuery(func: PostgresFunctionOptions<string>) {
        return new Query(func.definition)
      }

      private getDropFunctionQuery(func: PostgresFunctionOptions<string>) {
        return new Query(`DROP FUNCTION IF EXISTS "${func.name}"`)
      }

      private isUpdatedFunction(
        a: PostgresFunctionOptions<string>,
        b: PostgresFunctionOptions<string>
      ) {
        return a.definition !== b.definition
      }
    }

    return new PostgresExtension()
  }
}

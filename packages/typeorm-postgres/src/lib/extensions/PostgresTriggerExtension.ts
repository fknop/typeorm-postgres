import {EntityMetadata, RdbmsSchemaBuilderHook} from 'typeorm'

// These imports are not ideal, if TypeORM decide to change the locations of these files, it will not work anymore
import {SqlInMemory} from 'typeorm/driver/SqlInMemory'
import {Query} from 'typeorm/driver/Query'
import {RdbmsSchemaBuilder} from 'typeorm/schema-builder/RdbmsSchemaBuilder'
import {PostgresQueryRunner} from 'typeorm/driver/postgres/PostgresQueryRunner'

import {getPostgresMetadataArgsStorage} from '../metadata/TypeormPostgresArgsMetadata'
import {PostgresTriggerOptions} from '../options/PostgresTriggerOptions'

const METADATA_TYPE = 'POSTGRES_TRIGGER'

type PostgresTrigger = PostgresTriggerOptions & {
  tableName: string
  functionName: string
}

export class PostgresTriggerExtension {
  static init(): RdbmsSchemaBuilderHook {
    class PostgresExtension implements RdbmsSchemaBuilderHook {
      private existingTriggers: WeakMap<
        RdbmsSchemaBuilder,
        {name: string; definition: string}[]
      > = new WeakMap()

      private metadataTable = 'typeorm_metadata'

      async init(
        queryRunner: PostgresQueryRunner,
        schemaBuilder: RdbmsSchemaBuilder
      ): Promise<void> {
        this.metadataTable = queryRunner.getTypeormMetadataTableName()

        this.existingTriggers.set(
          schemaBuilder,
          await this.getCurrentTriggers(queryRunner)
        )
      }

      afterAll(
        queryRunner: PostgresQueryRunner,
        schemaBuilder: RdbmsSchemaBuilder,
        entityMetadatas: EntityMetadata[]
      ): Promise<SqlInMemory> {
        const sqlInMemory = new SqlInMemory()

        const args = getPostgresMetadataArgsStorage()
        const triggers = args.triggers
        const triggersToSync: PostgresTrigger[] = []

        triggers?.forEach((trigger) => {
          if (trigger) {
            const target = trigger.target

            const matchingEntity = entityMetadatas.find(
              (entity) => entity.target === target
            )

            if (matchingEntity) {
              triggersToSync.push({
                ...trigger.options,
                tableName: matchingEntity.tableName,
                functionName: this.getFunctionName(trigger.options),
              })
            }
          }
        })

        const existingFunctions = this.existingTriggers.get(schemaBuilder) ?? []

        const functionsQueries = this.getTriggerQueries(queryRunner, {
          existingTriggers: existingFunctions,
          triggersToSync: triggersToSync,
        })

        sqlInMemory.upQueries.push(...functionsQueries.upQueries)
        sqlInMemory.downQueries.push(...functionsQueries.downQueries)

        return Promise.resolve(sqlInMemory)
      }

      private async getCurrentTriggers(
        queryRunner: PostgresQueryRunner
      ): Promise<{name: string; definition: string}[]> {
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

        return metadatas.map((metadata) => ({
          name: metadata.name,
          definition: metadata.value,
        }))
      }

      private getTriggerQueries(
        queryRunner: PostgresQueryRunner,
        {
          existingTriggers,
          triggersToSync,
        }: {
          existingTriggers: {name: string; definition: string}[]
          triggersToSync: PostgresTrigger[]
        }
      ): SqlInMemory {
        const sqlInMemory = new SqlInMemory()

        const triggersToDrop: {name: string; definition: string}[] = []
        const triggersToCreate: PostgresTrigger[] = []
        const triggersToUpdate: {
          old: {definition: string}
          new: PostgresTrigger
        }[] = []

        existingTriggers.forEach((existingTrigger) => {
          const triggerToSync = triggersToSync.find(
            (triggerToSync) => existingTrigger.name === triggerToSync.name
          )

          if (!triggerToSync) {
            triggersToDrop.push(existingTrigger)
          } else if (this.hasTriggerChanged(triggerToSync, existingTrigger)) {
            triggersToUpdate.push({
              old: existingTrigger,
              new: triggerToSync,
            })
          }
        })

        triggersToSync.forEach((triggerToSync) => {
          if (
            !existingTriggers.find(
              (trigger) => trigger.name === triggerToSync.name
            )
          ) {
            triggersToCreate.push(triggerToSync)
          }
        })

        triggersToDrop.forEach((triggerToDrop) => {
          sqlInMemory.upQueries.push(this.getDropTriggerQuery(triggerToDrop))
          sqlInMemory.downQueries.push(
            this.getCreateTriggerFromDefinition(triggerToDrop)
          )

          sqlInMemory.upQueries.push(
            queryRunner.deleteTypeormMetadataSql({
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              name: triggerToDrop.name,
            })
          )
          sqlInMemory.downQueries.push(
            queryRunner.insertTypeormMetadataSql({
              name: triggerToDrop.name,
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              value: triggerToDrop.definition,
            })
          )
        })

        triggersToCreate.forEach((triggerToCreate) => {
          sqlInMemory.upQueries.push(
            this.getCreateTriggerQuery(triggerToCreate)
          )
          sqlInMemory.downQueries.push(
            this.getDropTriggerQuery(triggerToCreate)
          )

          sqlInMemory.upQueries.push(
            queryRunner.insertTypeormMetadataSql({
              name: triggerToCreate.name,
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              value: this.getCreateStatement(triggerToCreate),
            })
          )
          sqlInMemory.downQueries.push(
            queryRunner.deleteTypeormMetadataSql({
              // Typeorm doesn't allow any string in the type parameter - should we reimplement this method?
              type: METADATA_TYPE as any,
              name: triggerToCreate.name,
            })
          )
        })

        triggersToUpdate.forEach((trigger) => {
          sqlInMemory.upQueries.push(this.getCreateTriggerQuery(trigger.new))
          sqlInMemory.downQueries.push(
            this.getCreateTriggerFromDefinition(trigger.old)
          )
        })

        return sqlInMemory
      }

      private getCreateTriggerQuery(trigger: PostgresTrigger) {
        return new Query(this.getCreateStatement(trigger))
      }

      private getCreateTriggerFromDefinition(trigger: {definition: string}) {
        return new Query(trigger.definition)
      }

      private getDropTriggerQuery(trigger: {name: string}) {
        return new Query(`DROP TRIGGER IF EXISTS "${trigger.name}"`)
      }

      private getFunctionName(trigger: PostgresTriggerOptions): string {
        if (typeof trigger.execute === 'string') {
          if (trigger.execute.includes('(')) {
            return trigger.execute
          }

          return `${trigger.execute}()`
        }

        const functionTarget = getPostgresMetadataArgsStorage().filterFunctions(
          trigger.execute()
        )

        if (!functionTarget) {
          throw new Error(
            `Cannot find function to execute ${trigger.execute()} for PostgresTrigger ${
              trigger.name
            }`
          )
        }

        return `${functionTarget.options.name}()`
      }

      private hasTriggerChanged(
        trigger: PostgresTrigger,
        oldTrigger: {definition: string}
      ): boolean {
        return this.getCreateStatement(trigger) !== oldTrigger.definition
      }

      private getCreateStatement(trigger: PostgresTrigger): string {
        return `
          CREATE OR REPLACE TRIGGER ${trigger.name}
          ${trigger.when} ${trigger.event.join(' OR ')}
          ON ${trigger.tableName}${
          trigger.referencing
            ? `${
                trigger.referencing.oldTable || trigger.referencing.newTable
                  ? '\nREFERENCING'
                  : ''
              }${
                trigger.referencing.oldTable
                  ? ` OLD TABLE AS ${trigger.referencing.oldTable}`
                  : ''
              }${
                trigger.referencing.newTable
                  ? ` NEW TABLE AS ${trigger.referencing.newTable}`
                  : ''
              }`
            : ''
        }
          ${trigger.forEach === 'row' ? 'FOR EACH ROW' : 'FOR EACH STATEMENT'}${
          trigger.condition ? `\nWHEN (${trigger.condition})` : ''
        }
          EXECUTE FUNCTION ${trigger.functionName};
        `
      }
    }

    return new PostgresExtension()
  }
}

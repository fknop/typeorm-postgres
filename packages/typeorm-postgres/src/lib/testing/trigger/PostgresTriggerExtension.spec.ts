import {DataSource} from 'typeorm'
import {
  closeTestingDataSource,
  createTestingDataSource,
  initializeDatabaseBeforeAll,
} from '../createTestingDataSource'
import {PostgresTriggerExtension} from '../../extensions/PostgresTriggerExtension'
import {EntityWithTrigger} from './entities/EntityWithTrigger'
import {PostgresFunctionExtension} from '../../extensions/PostgresFunctionExtension'
import {FunctionForTrigger} from './functions/FunctionForTrigger'
import {EntityWithMultipleTriggers} from './entities/EntityWithMultipleTriggers'

describe('PostgresTriggerExtension', () => {
  initializeDatabaseBeforeAll()

  describe('generate migrations for EntityWithTrigger', () => {
    let dataSource: DataSource
    beforeAll(async () => {
      dataSource = await createTestingDataSource({
        entities: [EntityWithTrigger],
        schemaBuilderHooks: [
          PostgresFunctionExtension.init({functions: [FunctionForTrigger]}),
          PostgresTriggerExtension.init(),
        ],
        synchronize: false,
        dropSchema: true,
      })
    })

    afterAll(() => {
      return closeTestingDataSource(dataSource)
    })

    it('should generate proper create migrations', async () => {
      const queries = await dataSource.driver.createSchemaBuilder().log()
      expect(queries).toMatchSnapshot()
    })

    it('should not generate migrations', async () => {
      await dataSource.synchronize(false)
      const queries = await dataSource.driver.createSchemaBuilder().log()

      expect(queries.upQueries).toHaveLength(0)
      expect(queries.downQueries).toHaveLength(0)
    })
  })

  // describe('generate migrations for EntityWithMultipleTriggers', () => {
  //   let dataSource: DataSource
  //   beforeAll(async () => {
  //     dataSource = await createTestingDataSource({
  //       entities: [EntityWithMultipleTriggers],
  //       schemaBuilderHooks: [
  //         PostgresFunctionExtension.init({functions: [FunctionForTrigger]}),
  //         PostgresTriggerExtension.init(),
  //       ],
  //       synchronize: false,
  //       dropSchema: true,
  //     })
  //   })
  //
  //   afterAll(() => {
  //     return closeTestingDataSource(dataSource)
  //   })
  //
  //   it('should generate proper create migrations', async () => {
  //     const queries = await dataSource.driver.createSchemaBuilder().log()
  //     expect(queries).toMatchSnapshot()
  //   })
  //
  //   it('should not generate migrations', async () => {
  //     await dataSource.synchronize(false)
  //     const queries = await dataSource.driver.createSchemaBuilder().log()
  //
  //     expect(queries.upQueries).toHaveLength(0)
  //     expect(queries.downQueries).toHaveLength(0)
  //   })
  // })
})

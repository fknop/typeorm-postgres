import {DataSource} from 'typeorm'
import {
  closeTestingDataSource,
  createTestingDataSource,
  initializeDatabaseBeforeAll,
} from '../createTestingDataSource'
import {PostgresSequenceExtension} from '../../extensions/PostgresSequenceExtension'
import {SequenceOne} from './sequences/SequenceOne'
import {SequenceOneUpdated} from './sequences/SequenceOneUpdated'

describe('PostgresSequenceExtension', () => {
  initializeDatabaseBeforeAll()

  describe('generate migrations', () => {
    let dataSource: DataSource
    beforeAll(async () => {
      dataSource = await createTestingDataSource({
        entities: [],
        schemaBuilderHooks: [
          PostgresSequenceExtension.register({sequences: [SequenceOne]}),
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

    it('should alter the sequence', async () => {
      await dataSource.synchronize(false)
      const alterDataSource = await createTestingDataSource({
        entities: [],
        schemaBuilderHooks: [
          PostgresSequenceExtension.register({sequences: [SequenceOneUpdated]}),
        ],
        synchronize: false,
        dropSchema: false,
      })

      const queries = await alterDataSource.driver.createSchemaBuilder().log()
      expect(queries).toMatchSnapshot()

      await closeTestingDataSource(alterDataSource)
    })

    it('should delete the sequence', async () => {
      await dataSource.synchronize(false)
      const deleteDataSource = await createTestingDataSource({
        entities: [],
        schemaBuilderHooks: [
          PostgresSequenceExtension.register({sequences: []}),
        ],
        synchronize: false,
        dropSchema: false,
      })

      const queries = await deleteDataSource.driver.createSchemaBuilder().log()
      expect(queries).toMatchSnapshot()

      await closeTestingDataSource(deleteDataSource)
    })
  })
})

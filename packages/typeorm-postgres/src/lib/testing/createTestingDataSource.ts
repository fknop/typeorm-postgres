import {DataSource, DataSourceOptions} from 'typeorm'

const DATABASE = process.env['DATABASE'] ?? 'test'
const DATABASE_USERNAME = process.env['DATABASE_USERNAME'] ?? 'postgres'
const DATABASE_PASSWORD = process.env['DATABASE_PASSWORD'] ?? 'root'
const DATABASE_HOST = process.env['DATABASE_HOST'] ?? 'localhost'
const DATABASE_PORT = process.env['DATABASE_PORT']
  ? parseInt(process.env['DATABASE_PORT'], 10)
  : 5432

export function initializeDatabaseBeforeAll() {
  beforeAll(async () => {
    const initDataSource: DataSource = new DataSource({
      type: 'postgres',
      host: DATABASE_HOST,
      port: DATABASE_PORT,
      username: DATABASE_USERNAME,
      password: DATABASE_PASSWORD,
      schema: 'public',
      logging: false,
    })

    await initDataSource.initialize()

    const queryRunner = await initDataSource.createQueryRunner()
    await queryRunner.dropDatabase(DATABASE, true)
    await queryRunner.createDatabase(DATABASE, true)
    await queryRunner.release()

    await initDataSource.destroy()
  })
}

export async function createTestingDataSource(
  options: Pick<
    DataSourceOptions,
    'entities' | 'schemaBuilderHooks' | 'synchronize' | 'dropSchema'
  >
): Promise<DataSource> {
  const dataSource: DataSource = new DataSource({
    type: 'postgres',
    host: DATABASE_HOST,
    port: DATABASE_PORT,
    username: DATABASE_USERNAME,
    password: DATABASE_PASSWORD,
    schema: 'public',
    database: DATABASE,
    logging: false,
    ...options,
  })

  await dataSource.initialize()

  return dataSource
}

export async function closeTestingDataSource(dataSource: DataSource) {
  return dataSource.isInitialized ? await dataSource.destroy() : undefined
}

export async function reloadTestingDatabases(dataSource: DataSource) {
  return await dataSource.synchronize(true)
}

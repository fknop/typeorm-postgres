export type SequenceDataType = 'smallint' | 'integer' | 'bigint'

export interface PostgresSequenceOptions {
  dataType: SequenceDataType
  start?: number | bigint
  minValue?: number | bigint
  maxValue?: number | bigint
  cycle?: boolean
  increment?: number
  name: string
}

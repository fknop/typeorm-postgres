type TriggerEvent = 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE'
type TriggerWhen = 'BEFORE' | 'AFTER' | 'INSTEAD'

export interface PostgresTriggerOptions {
  name: string
  when: TriggerWhen
  execute: (() => Function) | string
  event: [TriggerEvent, ...TriggerEvent[]]
  deferrable?:
    | 'NOT DEFERRABLE'
    | 'DEFERRABLE'
    | 'INITIALLY IMMEDIATE'
    | 'INITIALLY DEFERRED'
  forEach?: 'row' | 'statement'
  referencing?: {
    oldTable?: string
    newTable?: string
  }
  condition?: string
}

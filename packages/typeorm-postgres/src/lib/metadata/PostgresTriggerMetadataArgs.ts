import {PostgresTriggerOptions} from '../options/PostgresTriggerOptions'

export interface PostgresTriggerMetadataArgs {
  target: string | Function
  options: PostgresTriggerOptions
}

import {PostgresFunctionOptions} from '../options/PostgresFunctionOptions'

export interface PostgresFunctionMetadataArgs {
  target: string | Function
  options: PostgresFunctionOptions<string>
}

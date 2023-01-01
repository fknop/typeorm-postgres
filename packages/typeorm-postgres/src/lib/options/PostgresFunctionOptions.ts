// Postgres Function have a lot of options, supporting them all in a user friendly-way would be too complicated
// Instead, a function definition using 'CREATE OR REPLACE FUNCTION' must be given
export interface PostgresFunctionOptions<Name extends string> {
  // This ensures that the name here is equal to the name defined in the function definition
  name: Name extends infer N ? N : never
  // Typing to ensure the user uses 'CREATE OR REPLACE FUNCTION' in the function definition
  definition: `${string}CREATE OR REPLACE FUNCTION ${Name}(${string}`
}

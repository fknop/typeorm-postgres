import {PostgresFunction} from '../../../decorators/PostgresFunction'

@PostgresFunction({
  name: 'add_integer',
  definition: `
      CREATE OR REPLACE FUNCTION add_integer(a integer, b integer) RETURNS integer AS $$
      DECLARE result integer;
      BEGIN
          RETURN a + b;
      END;
      $$ LANGUAGE plpgsql STABLE;
  `,
})
export class AddIntegerFunction {}

import {PostgresFunction} from '../../../decorators/PostgresFunction'

@PostgresFunction({
  name: 'prevent_update',
  definition: `
    CREATE OR REPLACE FUNCTION prevent_update() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        RAISE 'cannot update this record';
      END IF;
    END;
    $$ LANGUAGE plpgsql;
  `,
})
export class FunctionForTrigger {}

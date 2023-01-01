Experimental repository to demonstrate what a TypeORM extension system could look like using the work done by this pull request: https://github.com/typeorm/typeorm/pull/9328

The goal of these extensions is to register migrations hooks that could detect change for custom PostgreSQL database objects that are not managed by TypeORM such as sequences, triggers, functions, types, rules etc. This would allow defining custom database objects that are synchronized by TypeORM and included in migrations automatically.

This sample repository implements a proof of concept for sequences, functions and trigger functions.

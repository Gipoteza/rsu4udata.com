import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Таблица пользователей (один Admin)
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Токены сессий (JWT jti)
  await knex.schema.createTable('session_tokens', (t) => {
    t.string('jti', 128).primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamp('expires_at').notNullable();
    t.timestamp('revoked_at').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 4 филиала
  await knex.schema.createTable('branches', (t) => {
    t.integer('id').primary().checkIn([1, 2, 3, 4]);
    t.string('name', 100).notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('session_tokens');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('branches');
}

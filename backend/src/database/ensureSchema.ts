import bcrypt from 'bcrypt';
import db from './db';

// Идемпотентное создание всех таблиц и сидов.
// Вызывается автоматически при старте бэкенда.
export async function ensureSchema(): Promise<void> {
  if (!await db.schema.hasTable('users')) {
    await db.schema.createTable('users', (t) => {
      t.increments('id').primary();
      t.string('email', 255).notNullable().unique();
      t.string('password_hash', 255).notNullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    });
    console.log('[SCHEMA] users created');
  }

  if (!await db.schema.hasTable('session_tokens')) {
    await db.schema.createTable('session_tokens', (t) => {
      t.string('jti', 128).primary();
      t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.timestamp('expires_at').notNullable();
      t.timestamp('revoked_at').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log('[SCHEMA] session_tokens created');
  }

  if (!await db.schema.hasTable('branches')) {
    await db.schema.createTable('branches', (t) => {
      t.integer('id').primary();
      t.string('name', 100).notNullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
    await db('branches').insert([
      { id: 1, name: 'Киев' },
      { id: 2, name: 'Одесса' },
      { id: 3, name: 'Львов' },
      { id: 4, name: 'Варшава' },
    ]);
    console.log('[SCHEMA] branches created');
  }

  if (!await db.schema.hasTable('kommo_accounts')) {
    await db.schema.createTable('kommo_accounts', (t) => {
      t.increments('id').primary();
      t.integer('branch_id').notNullable().unique().references('id').inTable('branches').onDelete('CASCADE');
      t.string('client_id', 255).nullable();
      t.text('client_secret_enc').nullable();
      t.string('base_domain', 255).nullable();
      t.text('access_token_enc').nullable();
      t.text('refresh_token_enc').nullable();
      t.timestamp('expires_at').nullable();
      t.string('status', 32).notNullable().defaultTo('not_connected');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    });
    console.log('[SCHEMA] kommo_accounts created');
  }

  if (!await db.schema.hasTable('facebook_accounts')) {
    await db.schema.createTable('facebook_accounts', (t) => {
      t.integer('id').primary();
      t.string('ad_account_id', 64).notNullable();
      t.string('account_name', 255).nullable();
      t.text('access_token_enc').notNullable();
      t.string('status', 32).notNullable().defaultTo('not_connected');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    });
    console.log('[SCHEMA] facebook_accounts created');
  }

  if (!await db.schema.hasTable('fb_campaign_map')) {
    await db.schema.createTable('fb_campaign_map', (t) => {
      t.integer('branch_id').primary().references('id').inTable('branches').onDelete('CASCADE');
      t.text('campaign_names').notNullable().defaultTo('[]');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    });
    console.log('[SCHEMA] fb_campaign_map created');
  }

  if (!await db.schema.hasTable('kommo_tag_map')) {
    await db.schema.createTable('kommo_tag_map', (t) => {
      t.integer('branch_id').primary().references('id').inTable('branches').onDelete('CASCADE');
      t.text('tag_names').notNullable().defaultTo('[]');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    });
    console.log('[SCHEMA] kommo_tag_map created');
  }

  if (!await db.schema.hasTable('forecast_tag_map')) {
    await db.schema.createTable('forecast_tag_map', (t) => {
      t.integer('branch_id').primary().references('id').inTable('branches').onDelete('CASCADE');
      t.text('tag_names').notNullable().defaultTo('[]');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    });
    console.log('[SCHEMA] forecast_tag_map created');
  }

  if (!await db.schema.hasTable('forecast_status_map')) {
    await db.schema.createTable('forecast_status_map', (t) => {
      t.integer('branch_id').primary().references('id').inTable('branches').onDelete('CASCADE');
      t.text('status_names').notNullable().defaultTo('[]');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    });
    console.log('[SCHEMA] forecast_status_map created');
  }

  // Создаём admin если его ещё нет
  const email = process.env.ADMIN_EMAIL || 'basegipoteza@gmail.com';
  const existing = await db('users').where({ email }).first();
  if (!existing) {
    const password = process.env.ADMIN_PASSWORD || 'Lets#-bro-Pass#323255';
    const hash = await bcrypt.hash(password, 12);
    await db('users').insert({ email, password_hash: hash });
    console.log('[SCHEMA] admin user created');
  }
}

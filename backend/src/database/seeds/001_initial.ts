import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

export async function seed(knex: Knex): Promise<void> {
  // Засидеть 4 филиала
  await knex('branches').insert([
    { id: 1, name: 'Branch 1' },
    { id: 2, name: 'Branch 2' },
    { id: 3, name: 'Branch 3' },
    { id: 4, name: 'Branch 4' },
  ]).onConflict('id').ignore();

  // Создать Admin если нет
  const email = process.env.ADMIN_EMAIL || 'admin@rsu4udata.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await knex('users').where({ email }).first();
  if (!existing) {
    const hash = await bcrypt.hash(password, 12);
    await knex('users').insert({ email, password_hash: hash });
  }
}

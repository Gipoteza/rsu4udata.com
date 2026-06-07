import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import db from '../database/db';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const TOKEN_TTL_HOURS = 24;

export interface JwtPayload {
  sub: string | number; // user id (jsonwebtoken может вернуть string)
  jti: string;
  iat: number;
  exp: number;
}

export const AuthService = {
  async login(email: string, password: string) {
    const user = await db('users').where({ email }).first();
    if (!user) throw new Error('INVALID_CREDENTIALS');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new Error('INVALID_CREDENTIALS');

    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    const token = jwt.sign(
      { sub: user.id, jti },
      JWT_SECRET,
      { expiresIn: `${TOKEN_TTL_HOURS}h` }
    );

    await db('session_tokens').insert({
      jti,
      user_id: user.id,
      expires_at: expiresAt,
    });

    return { token, user: { id: user.id, email: user.email } };
  },

  async logout(jti: string) {
    await db('session_tokens')
      .where({ jti })
      .update({ revoked_at: db.fn.now() });
  },

  async validateToken(token: string) {
    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
    } catch {
      throw new Error('INVALID_TOKEN');
    }

    const session = await db('session_tokens')
      .where({ jti: payload.jti })
      .first();

    if (!session || session.revoked_at) throw new Error('INVALID_TOKEN');
    if (new Date(session.expires_at) < new Date()) throw new Error('EXPIRED_TOKEN');

    const user = await db('users').where({ id: payload.sub }).first();
    if (!user) throw new Error('INVALID_TOKEN');

    return { id: user.id, email: user.email };
  },
};

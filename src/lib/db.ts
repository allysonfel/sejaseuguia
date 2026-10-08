import postgres from "postgres";
import { hashPassword } from "./password";
import { SEED_DESTINATION, SEED_POIS } from "./seedData";
import { DEFAULT_PERMISSIONS, DEFAULT_RULES } from "./types";

// Cliente único reaproveitado entre requisições (no dev, guardado no
// globalThis pra sobreviver ao hot reload sem abrir conexões novas).
const g = globalThis as unknown as { __ssgSql?: postgres.Sql; __ssgSchema?: Promise<void> };

const url = process.env.DATABASE_URL ?? "";
export const sql =
  g.__ssgSql ??
  postgres(url, {
    ssl: /railway\.internal|localhost|127\.0\.0\.1/.test(url) ? false : "require",
    max: 10,
    onnotice: () => {},
  });
if (process.env.NODE_ENV !== "production") g.__ssgSql = sql;

// Cria as tabelas e a carga inicial na primeira chamada (sem migração manual).
export function ensureSchema(): Promise<void> {
  if (!g.__ssgSchema) {
    g.__ssgSchema = createSchema().catch((e) => {
      g.__ssgSchema = undefined;
      throw e;
    });
  }
  return g.__ssgSchema;
}

async function createSchema() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('traveler','staff')),
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      staff_role TEXT,
      profile JSONB,
      prefs JSONB NOT NULL DEFAULT '{"location":true,"history":true,"offers":false}',
      avatar TEXT,
      consent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));

    CREATE TABLE IF NOT EXISTS destinations (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      pais TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      moeda TEXT NOT NULL DEFAULT '€',
      update_freq TEXT NOT NULL DEFAULT 'Mensal',
      cor1 TEXT NOT NULL DEFAULT '#FFB21E',
      cor2 TEXT NOT NULL DEFAULT '#101B3B',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS pois (
      id SERIAL PRIMARY KEY,
      destination_id INT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      cat TEXT NOT NULL,
      bairro TEXT NOT NULL DEFAULT '',
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      dur INT NOT NULL DEFAULT 60,
      abre TEXT NOT NULL DEFAULT '09:00',
      fecha TEXT NOT NULL DEFAULT '18:00',
      preco INT NOT NULL DEFAULT 1,
      reserva BOOLEAN NOT NULL DEFAULT false,
      indoor BOOLEAN NOT NULL DEFAULT true,
      meal BOOLEAN NOT NULL DEFAULT false,
      tags TEXT[] NOT NULL DEFAULT '{}',
      closed_days INT[] NOT NULL DEFAULT '{}',
      tip TEXT,
      historia TEXT,
      curiosidades JSONB NOT NULL DEFAULT '[]',
      datas JSONB NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'Curadoria',
      reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS pois_dest_idx ON pois (destination_id);

    CREATE TABLE IF NOT EXISTS trips (
      id SERIAL PRIMARY KEY,
      owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      destination_id INT NOT NULL REFERENCES destinations(id),
      hotel_nome TEXT NOT NULL,
      hotel_lat DOUBLE PRECISION NOT NULL,
      hotel_lng DOUBLE PRECISION NOT NULL,
      inicio DATE NOT NULL,
      fim DATE NOT NULL,
      pax INT NOT NULL DEFAULT 1,
      days JSONB NOT NULL DEFAULT '[]',
      version INT NOT NULL DEFAULT 1,
      share_slug TEXT NOT NULL UNIQUE,
      share_public BOOLEAN NOT NULL DEFAULT false,
      hide_res BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS trips_owner_idx ON trips (owner_id);

    CREATE TABLE IF NOT EXISTS trip_members (
      id SERIAL PRIMARY KEY,
      trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (trip_id, email)
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      nome TEXT NOT NULL,
      data DATE,
      hora TEXT,
      codigo TEXT,
      info TEXT,
      poi_id INT REFERENCES pois(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS replan_events (
      id SERIAL PRIMARY KEY,
      trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      kind TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS trip_activity (
      id SERIAL PRIMARY KEY,
      trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      texto TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS ratings (
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      poi_id INT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
      stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, trip_id, poi_id)
    );

    CREATE TABLE IF NOT EXISTS discoveries (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      poi_id INT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, poi_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS privacy_requests (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      user_nome TEXT NOT NULL,
      user_email TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('export','delete')),
      status TEXT NOT NULL DEFAULT 'Pendente',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      done_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS destination_requests (
      id SERIAL PRIMARY KEY,
      termo TEXT NOT NULL,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Lugares importados que a equipe descartou: a próxima importação não traz de volta.
    CREATE TABLE IF NOT EXISTS import_skips (
      destination_id INT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      PRIMARY KEY (destination_id, nome)
    );

    -- Foto do destino (Wikimedia Commons ou URL da equipe) e crédito do autor.
    ALTER TABLE destinations ADD COLUMN IF NOT EXISTS foto_url TEXT;
    ALTER TABLE destinations ADD COLUMN IF NOT EXISTS foto_credito TEXT;
    ALTER TABLE destinations ADD COLUMN IF NOT EXISTS foto_buscada_em TIMESTAMPTZ;
  `);

  await sql`
    INSERT INTO settings (key, value) VALUES
      ('rules', ${sql.json({ ...DEFAULT_RULES, version: 1, publishedAt: new Date().toISOString() })}),
      ('rules_draft', ${sql.json(DEFAULT_RULES)}),
      ('permissions', ${sql.json(DEFAULT_PERMISSIONS)})
    ON CONFLICT (key) DO NOTHING
  `;

  const [{ count: destCount }] = await sql<{ count: string }[]>`SELECT count(*) FROM destinations`;
  if (Number(destCount) === 0) {
    const d = SEED_DESTINATION;
    const [{ id }] = await sql<{ id: number }[]>`
      INSERT INTO destinations (nome, pais, lat, lng, moeda, update_freq, cor1, cor2)
      VALUES (${d.nome}, ${d.pais}, ${d.lat}, ${d.lng}, ${d.moeda}, ${d.updateFreq}, ${d.cor1}, ${d.cor2})
      RETURNING id`;
    for (const p of SEED_POIS) {
      await sql`
        INSERT INTO pois (destination_id, nome, cat, bairro, lat, lng, dur, abre, fecha, preco, reserva, indoor, meal,
                          tags, closed_days, tip, historia, curiosidades, datas, source)
        VALUES (${id}, ${p.nome}, ${p.cat}, ${p.bairro}, ${p.lat}, ${p.lng}, ${p.dur}, ${p.abre}, ${p.fecha}, ${p.preco},
                ${p.reserva ?? false}, ${p.indoor}, ${p.meal ?? false}, ${p.tags}, ${p.closedDays ?? []}, ${p.tip ?? null},
                ${p.historia ?? null}, ${sql.json(p.curiosidades ?? [])}, ${sql.json(p.datas ?? [])}, ${p.source})`;
    }
  }

  const email = process.env.ADMIN_EMAIL?.trim();
  const pass = process.env.ADMIN_PASSWORD;
  if (email && pass) {
    const [{ count: staff }] = await sql<{ count: string }[]>`SELECT count(*) FROM users WHERE kind = 'staff'`;
    if (Number(staff) === 0) {
      await sql`
        INSERT INTO users (kind, nome, email, pass_hash, staff_role, consent_at)
        VALUES ('staff', ${process.env.ADMIN_NAME?.trim() || "Administrador"}, ${email}, ${hashPassword(pass)}, 'Administrador', now())
        ON CONFLICT DO NOTHING`;
    }
  }

  // Destinos sem foto ganham uma em segundo plano (não segura a subida do app).
  import("./destFoto").then((m) => m.preencherFotosFaltantes()).catch((e) => console.error("[fotos]", (e as Error).message));
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  await ensureSchema();
  const rows = await sql<{ value: T }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await ensureSchema();
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${sql.json(value as never)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

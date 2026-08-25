import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getD1(): D1Database {
  const database = env.DB;

  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Check the Sites binding configuration.",
    );
  }

  return database;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

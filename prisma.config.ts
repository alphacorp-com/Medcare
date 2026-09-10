import fs from "fs";
import path from "path";
import { defineConfig, env } from "prisma/config";

// Try to load `dotenv/config`. If it's not installed (npm install failed),
// fall back to a minimal .env parser so Prisma can still read `DATABASE_URL`.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv/config");
} catch (e) {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*(.*)?\s*$/);
      if (!m) continue;
      let [, key, val] = m;
      if (!val) val = "";
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

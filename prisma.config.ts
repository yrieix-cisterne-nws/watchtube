import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Avoid throwing during commands like `prisma generate` when DATABASE_URL
    // might not be set (e.g., CI type-check only).
    url: process.env.DATABASE_URL ?? "",
  },
});

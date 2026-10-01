import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
  migrations: { path: "prisma/migrations" },
  // process.env y no env(): env() lanza error si falta la variable, y "prisma generate" (postinstall)
  // debe poder ejecutarse sin DATABASE_URL. Los comandos que sí usan la base la siguen exigiendo.
  datasource: { url: process.env.DATABASE_URL },
});

// @ts-check
// Cliente de Prisma compartido por toda la app.
//
// Se conecta con DATABASE_URL, que usa el usuario sin privilegios de la app:
// así PostgreSQL aplica Row-Level Security en cada consulta.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// Prisma 7 se conecta a PostgreSQL a través de un adaptador (driver `pg`).
const adaptador = new PrismaPg({ connectionString: env.DATABASE_URL });

/** Instancia única de Prisma. No crear otras: cada una abre su propio grupo de conexiones. */
export const prisma = new PrismaClient({ adapter: adaptador });

// @ts-check
// Variables de entorno de las pruebas. Las usan vitest.config.js y la preparación de la base.

export const variablesDePrueba = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  // La app se conecta con el usuario sin privilegios para que RLS aplique igual que en producción.
  DATABASE_URL: 'postgresql://zenda_app:zenda_app@localhost:5433/zenda_test',
  // El dueño de las tablas solo se usa para migrar y limpiar la base de pruebas.
  DATABASE_URL_MIGRACIONES: 'postgresql://zenda:zenda@localhost:5433/zenda_test',
  REDIS_URL: 'redis://localhost:6379',
  // Clave solo para pruebas; no sirve fuera de ellas.
  JWT_SECRET: 'clave-de-pruebas-que-no-se-usa-en-ningun-otro-lugar',
  // Límites altos: las pruebas hacen muchos logins seguidos desde la misma IP.
  // El comportamiento del límite se prueba aparte (tests/seguridad.test.js).
  LIMITE_LOGIN_POR_MINUTO: '100000',
  LIMITE_REFRESH_POR_MINUTO: '100000',
  LIMITE_REGISTRO_POR_HORA: '100000',
};

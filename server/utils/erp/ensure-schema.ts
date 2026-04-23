import type { Pool, RowDataPacket } from 'mysql2/promise'

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS proyectos (
    id_proyecto VARCHAR(40) NOT NULL PRIMARY KEY,
    cliente VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    folio_propuesta VARCHAR(64) NULL,
    estatus ENUM('En Proceso','Completado','Pendiente de Pago') NOT NULL DEFAULT 'En Proceso',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS proyecto_finanzas (
    id_proyecto VARCHAR(40) NOT NULL PRIMARY KEY,
    flete_usd DECIMAL(14,4) NOT NULL DEFAULT 0,
    aduana_usd DECIMAL(14,4) NOT NULL DEFAULT 0,
    porcentaje_servicio DECIMAL(8,4) NOT NULL DEFAULT 21,
    tarifa_importacion_pct DECIMAL(8,4) NOT NULL DEFAULT 20,
    anticipo_usd DECIMAL(14,4) NOT NULL DEFAULT 0,
    CONSTRAINT fk_pf_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS articulos (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    id_proyecto VARCHAR(40) NOT NULL,
    sg VARCHAR(128) NOT NULL,
    referencia_logistica VARCHAR(256) NULL,
    descripcion TEXT NOT NULL,
    imagen_url VARCHAR(2048) NOT NULL,
    cantidad_total INT NOT NULL DEFAULT 1,
    cantidad_recibida INT NOT NULL DEFAULT 0,
    precio_unitario DECIMAL(14,4) NOT NULL,
    estatus ENUM('Laredo','En Aduana','Monterrey') NOT NULL DEFAULT 'Laredo',
    CONSTRAINT fk_art_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    INDEX idx_art_proyecto (id_proyecto)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pagos (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    id_proyecto VARCHAR(40) NOT NULL,
    monto_usd DECIMAL(14,4) NOT NULL,
    fecha DATE NOT NULL,
    nota VARCHAR(512) NULL,
    CONSTRAINT fk_pago_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    INDEX idx_pagos_proyecto (id_proyecto)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS articulos_limbo (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    sg_provisional VARCHAR(128) NOT NULL,
    descripcion TEXT NOT NULL,
    imagen_url VARCHAR(2048) NOT NULL,
    fecha_registro DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
]

/** Columnas agregadas en versiones posteriores a la creación inicial. */
const COLUMN_MIGRATIONS: Array<[table: string, column: string, definition: string]> = [
  ['proyecto_finanzas', 'maniobras_usd', 'DECIMAL(14,4) NOT NULL DEFAULT 0'],
  ['proyecto_finanzas', 'flete_laredo_mty_usd', 'DECIMAL(14,4) NOT NULL DEFAULT 0'],
  ['proyecto_finanzas', 'flete_nacional_usd', 'DECIMAL(14,4) NOT NULL DEFAULT 0'],
  ['proyecto_finanzas', 'flete_extra_1_label', 'VARCHAR(128) NULL DEFAULT NULL'],
  ['proyecto_finanzas', 'flete_extra_1_usd', 'DECIMAL(14,4) NOT NULL DEFAULT 0'],
  ['proyecto_finanzas', 'flete_extra_2_label', 'VARCHAR(128) NULL DEFAULT NULL'],
  ['proyecto_finanzas', 'flete_extra_2_usd', 'DECIMAL(14,4) NOT NULL DEFAULT 0'],
  ['proyecto_finanzas', 'flete_extra_3_label', 'VARCHAR(128) NULL DEFAULT NULL'],
  ['proyecto_finanzas', 'flete_extra_3_usd', 'DECIMAL(14,4) NOT NULL DEFAULT 0'],
  ['proyecto_finanzas', 'igi_pct', 'DECIMAL(8,4) NOT NULL DEFAULT 0'],
  ['proyecto_finanzas', 'wire_transfer_usd', 'DECIMAL(14,4) NOT NULL DEFAULT 0'],
  ['proyecto_finanzas', 'comercializadora_pct', 'DECIMAL(8,4) NOT NULL DEFAULT 0']
]

async function addColumnIfMissing(pool: Pool, table: string, column: string, definition: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )
  if ((rows[0] as RowDataPacket & { cnt: number }).cnt === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
  }
}

export async function ensureErpSchema(pool: Pool): Promise<void> {
  for (const sql of CREATE_STATEMENTS) {
    await pool.query(sql)
  }
  for (const [table, column, definition] of COLUMN_MIGRATIONS) {
    await addColumnIfMissing(pool, table, column, definition)
  }
}

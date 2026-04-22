import type { Pool } from 'mysql2/promise'

const STATEMENTS = [
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

export async function ensureErpSchema(pool: Pool): Promise<void> {
  for (const sql of STATEMENTS) {
    await pool.query(sql)
  }
}

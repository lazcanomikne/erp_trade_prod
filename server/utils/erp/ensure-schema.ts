import { randomUUID } from 'node:crypto'
import type { Pool, RowDataPacket } from 'mysql2/promise'

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS clientes (
    id_cliente VARCHAR(40) NOT NULL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    UNIQUE KEY uq_cliente_nombre (nombre)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
  `CREATE TABLE IF NOT EXISTS proyecto_otros (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    id_proyecto VARCHAR(40) NOT NULL,
    descripcion VARCHAR(512) NOT NULL,
    monto_usd DECIMAL(14,4) NOT NULL DEFAULT 0,
    CONSTRAINT fk_otros_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    INDEX idx_otros_proyecto (id_proyecto)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS articulos_limbo (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    sg_provisional VARCHAR(128) NOT NULL,
    descripcion TEXT NOT NULL,
    imagen_url VARCHAR(2048) NOT NULL,
    fecha_registro DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS inventario_libre (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    sg VARCHAR(128) NOT NULL,
    descripcion TEXT NOT NULL,
    imagen_url VARCHAR(2048) NOT NULL,
    marca VARCHAR(128) NULL DEFAULT NULL,
    bultos INT NOT NULL DEFAULT 0,
    numero_rack VARCHAR(64) NULL DEFAULT NULL,
    cantidad_total INT NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(14,4) NOT NULL DEFAULT 0,
    estatus ENUM('Laredo','En Aduana','Monterrey') NOT NULL DEFAULT 'Monterrey',
    referencia_logistica VARCHAR(256) NULL,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS entregas (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    descripcion VARCHAR(255) NOT NULL,
    fecha_programada DATE NULL,
    chofer VARCHAR(255) NOT NULL DEFAULT '',
    origen TEXT NULL,
    estatus ENUM('Pendiente','En Ruta','Entregado','Parcial') NOT NULL DEFAULT 'Pendiente',
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS entrega_destinos (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    id_entrega VARCHAR(48) NOT NULL,
    cliente VARCHAR(255) NOT NULL,
    direccion TEXT NULL,
    orden INT NOT NULL DEFAULT 0,
    confirmado TINYINT(1) NOT NULL DEFAULT 0,
    firma_url MEDIUMTEXT NULL,
    foto_url MEDIUMTEXT NULL,
    CONSTRAINT fk_dest_entrega FOREIGN KEY (id_entrega) REFERENCES entregas(id) ON DELETE CASCADE,
    INDEX idx_dest_entrega (id_entrega)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS entrega_articulos (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    id_entrega VARCHAR(48) NOT NULL,
    id_proyecto VARCHAR(40) NULL,
    id_articulo VARCHAR(48) NOT NULL,
    descripcion VARCHAR(512) NOT NULL,
    sg VARCHAR(128) NOT NULL,
    cliente VARCHAR(255) NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    entregado TINYINT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_ea_entrega FOREIGN KEY (id_entrega) REFERENCES entregas(id) ON DELETE CASCADE,
    INDEX idx_ea_entrega (id_entrega)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pago_historia (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    id_pago VARCHAR(48) NOT NULL,
    id_proyecto VARCHAR(40) NOT NULL,
    accion ENUM('edicion','eliminacion') NOT NULL,
    motivo VARCHAR(512) NOT NULL,
    snapshot_antes TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phist_proyecto (id_proyecto)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS manifiestos (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    folio INT NOT NULL,
    fecha DATE NOT NULL,
    observaciones TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_manifiesto_folio (folio)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS manifiesto_lineas (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    id_manifiesto VARCHAR(48) NOT NULL,
    id_articulo VARCHAR(48) NOT NULL,
    id_proyecto VARCHAR(40) NOT NULL,
    sg VARCHAR(128) NOT NULL,
    descripcion_original TEXT NOT NULL,
    descripcion_generica TEXT NOT NULL,
    cantidad_corte INT NOT NULL DEFAULT 1,
    precio_original DECIMAL(14,4) NOT NULL DEFAULT 0,
    precio_corte DECIMAL(14,4) NOT NULL DEFAULT 0,
    CONSTRAINT fk_ml_manifiesto FOREIGN KEY (id_manifiesto) REFERENCES manifiestos(id) ON DELETE CASCADE,
    INDEX idx_ml_manifiesto (id_manifiesto),
    INDEX idx_ml_articulo (id_articulo),
    INDEX idx_ml_proyecto (id_proyecto)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS devoluciones (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    numero INT NOT NULL,
    fecha DATE NOT NULL,
    destino ENUM('Laredo','En Aduana','Monterrey') NOT NULL,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_devolucion_numero (numero)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS devolucion_articulos (
    id VARCHAR(48) NOT NULL PRIMARY KEY,
    id_devolucion VARCHAR(48) NOT NULL,
    id_proyecto VARCHAR(40) NOT NULL,
    id_articulo VARCHAR(48) NOT NULL,
    sg VARCHAR(128) NOT NULL,
    descripcion TEXT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    motivo ENUM('Dañado','Incompleto','Producto incorrecto','Área no lista','Otros') NOT NULL,
    motivo_detalle TEXT NULL,
    CONSTRAINT fk_da_devolucion FOREIGN KEY (id_devolucion) REFERENCES devoluciones(id) ON DELETE CASCADE,
    INDEX idx_da_devolucion (id_devolucion)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
]

/** Columnas agregadas en versiones posteriores a la creación inicial. */
const COLUMN_MIGRATIONS: Array<[table: string, column: string, definition: string]> = [
  ['articulos', 'marca', 'VARCHAR(128) NULL DEFAULT NULL'],
  ['articulos', 'bultos', 'INT NOT NULL DEFAULT 0'],
  ['articulos', 'numero_rack', 'VARCHAR(64) NULL DEFAULT NULL'],
  ['articulos', 'deleted_at', 'TIMESTAMP NULL DEFAULT NULL'],
  ['articulos', 'eliminacion_comentario', 'TEXT NULL DEFAULT NULL'],
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
  ['proyecto_finanzas', 'comercializadora_pct', 'DECIMAL(8,4) NOT NULL DEFAULT 0'],
  ['pagos', 'referencia', 'VARCHAR(256) NULL DEFAULT NULL'],
  ['pagos', 'forma_pago', 'VARCHAR(20) NULL DEFAULT NULL'],
  ['articulos', 'comprado_por_trade', 'TINYINT(1) NOT NULL DEFAULT 1'],
  ['devoluciones', 'cancelado', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['devoluciones', 'cancelado_at', 'TIMESTAMP NULL DEFAULT NULL'],
  ['proyectos', 'comprado_por_trade', 'TINYINT(1) NOT NULL DEFAULT 1'],
  ['proyectos', 'id_cliente', 'VARCHAR(40) NULL DEFAULT NULL'],
  ['proyectos', 'intermediario', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['proyectos', 'id_cliente_final', 'VARCHAR(40) NULL DEFAULT NULL'],
  ['proyectos', 'cliente_final', 'VARCHAR(255) NULL DEFAULT NULL'],
  ['proyecto_finanzas', 'despacho_aduanal_divisor', 'DECIMAL(14,4) NOT NULL DEFAULT 60000'],
  ['proyecto_finanzas', 'flete_logistica_divisor', 'DECIMAL(14,4) NOT NULL DEFAULT 60000']
]

/** Columnas que deben cambiar de tipo (p.ej. VARCHAR → TEXT/MEDIUMTEXT). */
const COLUMN_TYPE_UPGRADES: Array<[table: string, column: string, newDef: string, targetDataType: string]> = [
  ['entrega_destinos', 'firma_url', 'MEDIUMTEXT NULL', 'mediumtext'],
  ['entrega_destinos', 'foto_url', 'MEDIUMTEXT NULL', 'mediumtext']
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

async function upgradeColumnTypeIfNeeded(pool: Pool, table: string, column: string, newDef: string, targetDataType: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )
  const current = ((rows[0] as RowDataPacket & { DATA_TYPE: string })?.DATA_TYPE ?? '').toLowerCase()
  if (current && current !== targetDataType) {
    await pool.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${newDef}`)
  }
}

async function ensureEnumContains(pool: Pool, table: string, column: string, value: string, fullNewDef: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )
  const colType: string = ((rows[0] as RowDataPacket & { COLUMN_TYPE: string })?.COLUMN_TYPE ?? '')
  if (colType && !colType.includes(value)) {
    await pool.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${fullNewDef}`)
  }
}

export async function ensureErpSchema(pool: Pool): Promise<void> {
  for (const sql of CREATE_STATEMENTS) {
    await pool.query(sql)
  }
  for (const [table, column, definition] of COLUMN_MIGRATIONS) {
    await addColumnIfMissing(pool, table, column, definition)
  }
  for (const [table, column, newDef, targetType] of COLUMN_TYPE_UPGRADES) {
    await upgradeColumnTypeIfNeeded(pool, table, column, newDef, targetType)
  }
  await ensureEnumContains(
    pool, 'proyectos', 'estatus', 'Cotización',
    "ENUM('Cotización','En Proceso','Completado','Pendiente de Pago') NOT NULL DEFAULT 'Cotización'"
  )
  await migrateClientesFromProyectos(pool)
}

/** One-time migration: populate clientes table from proyectos.cliente strings and link via id_cliente. */
async function migrateClientesFromProyectos(pool: Pool): Promise<void> {
  const [distinct] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT TRIM(cliente) AS nombre FROM proyectos WHERE cliente != '' AND id_cliente IS NULL`
  )
  for (const row of distinct) {
    const nombre = String(row.nombre).trim()
    if (!nombre) continue
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id_cliente FROM clientes WHERE nombre = ? LIMIT 1`,
      [nombre]
    )
    let idCliente: string
    if (existing.length) {
      idCliente = String(existing[0]!.id_cliente)
    } else {
      idCliente = `cli-${randomUUID()}`
      await pool.query(
        `INSERT INTO clientes (id_cliente, nombre) VALUES (?, ?) ON DUPLICATE KEY UPDATE id_cliente = id_cliente`,
        [idCliente, nombre]
      )
      const [re] = await pool.query<RowDataPacket[]>(
        `SELECT id_cliente FROM clientes WHERE nombre = ? LIMIT 1`,
        [nombre]
      )
      idCliente = String(re[0]!.id_cliente)
    }
    await pool.query(
      `UPDATE proyectos SET id_cliente = ? WHERE TRIM(cliente) = ? AND id_cliente IS NULL`,
      [idCliente, nombre]
    )
  }
}

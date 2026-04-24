import { readBody, createError } from 'h3'
import { getMysqlPool } from '../../utils/db'
import { fetchFullSnapshot } from '../../utils/erp/repository'
import type { ErpSnapshot } from '../../utils/erp/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GroqResponse {
  choices: { message: { content: string } }[]
}

function usd(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildContext(snap: ErpSnapshot): string {
  const proyectos = snap.proyectos
  const limbo = snap.limbo

  let artGlobalTotal = 0
  let artLaredo = 0
  let artAduana = 0
  let artMonterrey = 0
  let valorGlobal = 0

  for (const p of proyectos) {
    for (const a of p.detalle.articulos) {
      artGlobalTotal++
      valorGlobal += a.precioUnitario * a.cantidadTotal
      if (a.estatus === 'Laredo') artLaredo++
      else if (a.estatus === 'En Aduana') artAduana++
      else if (a.estatus === 'Monterrey') artMonterrey++
    }
  }

  const lines: string[] = []

  lines.push('Eres el asistente inteligente del ERP de Logística Internacional. Tienes acceso completo y en tiempo real a todos los datos del sistema.')
  lines.push('Responde siempre en español. Sé conciso, directo y usa formato claro. Para montos usa formato con comas y símbolo $.')
  lines.push(`Fecha actual: ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`)
  lines.push('')
  lines.push('# DATOS DEL ERP')
  lines.push('')
  lines.push('## Resumen global')
  lines.push(`- Proyectos activos: ${proyectos.length}`)
  lines.push(`- Total artículos (todos los proyectos): ${artGlobalTotal}`)
  lines.push(`  • En Laredo: ${artLaredo}`)
  lines.push(`  • En Aduana: ${artAduana}`)
  lines.push(`  • En Monterrey (recibidos): ${artMonterrey}`)
  lines.push(`- Valor total de todos los artículos: ${usd(valorGlobal)}`)
  lines.push(`- Artículos no identificados (limbo): ${limbo.length}`)
  lines.push('')
  lines.push('## Detalle por proyecto')

  for (const p of proyectos) {
    const cab = p.cabecera
    const d = p.detalle
    const arts = d.articulos
    const laredo = arts.filter(a => a.estatus === 'Laredo')
    const aduana = arts.filter(a => a.estatus === 'En Aduana')
    const mty = arts.filter(a => a.estatus === 'Monterrey')
    const valorArts = arts.reduce((s, a) => s + a.precioUnitario * a.cantidadTotal, 0)
    const totalPagos = d.pagos.reduce((s, pg) => s + pg.montoUsd, 0)
    const totalRecibido = d.anticipoUsd + totalPagos

    lines.push('')
    lines.push(`### ${cab.nombre} (ID: ${cab.idProyecto})`)
    lines.push(`- Cliente: ${cab.cliente}`)
    if (cab.folioPropuesta) lines.push(`- Folio propuesta: ${cab.folioPropuesta}`)
    lines.push(`- Artículos: ${arts.length} total | Laredo: ${laredo.length} | En Aduana: ${aduana.length} | Monterrey: ${mty.length}`)
    lines.push(`- Valor total artículos: ${usd(valorArts)}`)
    lines.push(`- Anticipo inicial: ${usd(d.anticipoUsd)}`)
    if (d.pagos.length) lines.push(`- Pagos adicionales (${d.pagos.length}): ${usd(totalPagos)}`)
    lines.push(`- Total recibido del cliente: ${usd(totalRecibido)}`)
    lines.push(`- Saldo pendiente aprox.: ${usd(Math.max(0, valorArts - totalRecibido))}`)

    if (d.fleteUsd) lines.push(`- Flete internacional: ${usd(d.fleteUsd)}`)
    if (d.aduanaUsd) lines.push(`- Aduana: ${usd(d.aduanaUsd)}`)
    if (d.igiPct) lines.push(`- IGI: ${d.igiPct}%`)
    if (d.comercializadoraPct) lines.push(`- Comercializadora: ${d.comercializadoraPct}%`)
    if (d.maniobrasUsd) lines.push(`- Maniobras: ${usd(d.maniobrasUsd)}`)
    if (d.fleteLaredoMtyUsd) lines.push(`- Flete Laredo→MTY: ${usd(d.fleteLaredoMtyUsd)}`)

    if (arts.length) {
      lines.push(`- Artículos:`)
      for (const a of arts) {
        const sg = a.sg || '(sin SG)'
        const ref = a.referenciaLogistica ? ` [ref: ${a.referenciaLogistica}]` : ''
        const marca = a.marca ? ` (${a.marca})` : ''
        lines.push(`  • ${sg}${ref} | ${a.descripcion}${marca} | Cant: ${a.cantidadTotal} | ${usd(a.precioUnitario)} c/u | ${a.estatus}`)
      }
    }

    if (d.pagos.length) {
      lines.push(`- Historial de pagos:`)
      for (const pg of d.pagos) {
        const extra = [pg.formaPago, pg.referencia ? `ref: ${pg.referencia}` : ''].filter(Boolean).join(', ')
        lines.push(`  • ${usd(pg.montoUsd)} el ${pg.fecha}${extra ? ` (${extra})` : ''}`)
      }
    }
  }

  if (limbo.length) {
    lines.push('')
    lines.push('## Artículos no identificados (limbo/arriboNI)')
    for (const l of limbo) {
      lines.push(`- ${l.sgProvisional} | ${l.descripcion} | Fecha registro: ${l.fechaRegistro}`)
    }
  }

  return lines.join('\n')
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ message: string; history: ChatMessage[] }>(event)
  if (!body?.message?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Mensaje vacío' })
  }

  const config = useRuntimeConfig()
  const pool = getMysqlPool()
  const snap = await fetchFullSnapshot(pool)
  const systemPrompt = buildContext(snap)

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(body.history ?? []).slice(-12),
    { role: 'user', content: body.message.trim() }
  ]

  const groq = await $fetch<GroqResponse>('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: {
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.2,
      max_tokens: 1024
    }
  })

  return { reply: groq.choices[0]?.message?.content ?? 'Sin respuesta del asistente.' }
})

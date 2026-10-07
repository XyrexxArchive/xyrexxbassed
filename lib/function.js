const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const readline = require('readline')
const pino = require('pino')
const { downloadMediaMessage } = require('@itsliaaa/baileys')

const logger = pino({ level: 'silent' })
const dbDir = path.join(__dirname, '..', 'db')
const ownerFile = path.join(dbDir, 'owner.json')
const premiumFile = path.join(dbDir, 'premium.json')
const groupFile = path.join(dbDir, 'group.json')

const wrappers = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage',
  'editedMessage',
  'lottieStickerMessage',
  'spoilerMessage'
]

const mediaTypes = [
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'stickerMessage',
  'documentMessage'
]

const units = {
  s: 1000,
  m: 60000,
  h: 3600000,
  d: 86400000,
  w: 604800000,
  y: 31536000000
}

const lidCache = new Map()
const imageCache = new Map()

const crcTable = (() => {
  const table = new Uint32Array(256)

  for (let n = 0; n < 256; n++) {
    let c = n

    for (let k = 0; k < 8; k++) {
      c = c & 1
        ? 0xedb88320 ^ (c >>> 1)
        : c >>> 1
    }

    table[n] = c >>> 0
  }

  return table
})()

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms))

const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })

const toNumber = (value = '') =>
  String(value)
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '')

const hasPrefix = (body = '') =>
  (global.prefix || ['.']).some((p) => body.startsWith(p))

const readJSON = (file, fallback) => {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    return raw.trim() ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const writeJSON = (file, data) => {
  const temp = `${file}.tmp`
  fs.writeFileSync(temp, JSON.stringify(data, null, 2))
  fs.renameSync(temp, file)
}

const readList = (file) => {
  const data = readJSON(file, [])
  return Array.isArray(data) ? data : []
}

const initDB = () => {
  fs.mkdirSync(dbDir, { recursive: true })

  if (!fs.existsSync(ownerFile)) {
    writeJSON(ownerFile, [])
  }

  if (!fs.existsSync(premiumFile)) {
    writeJSON(premiumFile, [])
  }

  if (!fs.existsSync(groupFile)) {
    writeJSON(groupFile, {})
  }     
}

const getOwners = () => {
  const main = (global.owner || []).map(toNumber)
  const stored = readList(ownerFile).map(toNumber)

  return [
    ...new Set([
      ...main,
      ...stored
    ])
  ].filter(Boolean)
}

const addOwner = (number) => {
  const num = toNumber(number)

  if (!num) return 'invalid'
  if (getOwners().includes(num)) return 'exists'

  writeJSON(ownerFile, [
    ...readList(ownerFile).map(toNumber),
    num
  ])

  return 'added'
}

const delOwner = (number) => {
  const num = toNumber(number)

  if ((global.owner || []).map(toNumber).includes(num)) {
    return 'main'
  }

  const list = readList(ownerFile).map(toNumber)

  if (!list.includes(num)) {
    return 'missing'
  }

  writeJSON(
    ownerFile,
    list.filter((v) => v !== num)
  )

  return 'removed'
}

const isOwnerAny = (numbers) => {
  const owners = getOwners()
  return numbers.some((n) => owners.includes(n))
}

const getPremium = () => {
  const now = Date.now()

  const list = readList(premiumFile).filter(
    (v) => v && v.id
  )

  const active = list.filter(
    (v) => !v.expired || v.expired > now
  )

  if (active.length !== list.length) {
    writeJSON(premiumFile, active)
  }

  return active
}

const addPremium = (number, duration = 0) => {
  const id = toNumber(number)

  if (!id) return null

  const list = getPremium()
  const existing = list.find((v) => v.id === id)

  const base =
    existing && existing.expired
      ? existing.expired
      : Date.now()

  const expired = duration
    ? base + duration
    : 0

  writeJSON(premiumFile, [
    ...list.filter((v) => v.id !== id),
    { id, expired }
  ])

  return expired
}

const delPremium = (number) => {
  const id = toNumber(number)
  const list = getPremium()

  if (!list.some((v) => v.id === id)) {
    return false
  }

  writeJSON(
    premiumFile,
    list.filter((v) => v.id !== id)
  )

  return true
}

const findPremium = (numbers) =>
  getPremium().find((v) => numbers.includes(v.id))

const parseDuration = (value = '') => {
  const match = /^(\d+)(s|m|h|d|w|y)$/i.exec(value)

  return match
    ? Number(match[1]) * units[match[2].toLowerCase()]
    : 0
}

const formatDuration = (ms) => {
  const total = Math.floor(ms / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  return [
    d && `${d} hari`,
    h && `${h} jam`,
    m && `${m} menit`,
    `${s} detik`
  ]
    .filter(Boolean)
    .join(' ')
}

const formatDate = (ms) =>
  new Date(ms).toLocaleString('id-ID', {
    timeZone: global.timezone || 'Asia/Jakarta'
  })

const unwrap = (message) => {
  let current = message

  while (current) {
    const key = wrappers.find(
      (k) => current[k] && current[k].message
    )

    if (!key) break

    current = current[key].message
  }

  return current || {}
}

const getType = (content) =>
  Object.keys(content || {}).find(
    (k) =>
      k !== 'senderKeyDistributionMessage' &&
      k !== 'messageContextInfo'
  ) || ''

const extractBody = (type, content) => {
  const node = content[type]

  if (type === 'conversation') {
    return content.conversation || ''
  }

  if (!node || typeof node !== 'object') {
    return ''
  }

  if (type === 'extendedTextMessage') {
    return node.text || ''
  }

  if (type === 'buttonsResponseMessage') {
    return node.selectedButtonId || ''
  }

  if (type === 'listResponseMessage') {
    return (
      node.singleSelectReply &&
      node.singleSelectReply.selectedRowId
    ) || ''
  }

  if (type === 'templateButtonReplyMessage') {
    return node.selectedId || ''
  }

  if (type === 'interactiveResponseMessage') {
    const response = node.nativeFlowResponseMessage

    if (!response || !response.paramsJson) {
      return ''
    }

    try {
      const parsed = JSON.parse(response.paramsJson)

      return (
        parsed.id ||
        parsed.selected_id ||
        parsed.row_id ||
        parsed.button_id ||
        parsed.command ||
        ''
      )
    } catch {
      return ''
    }
  }

  if (type === 'nativeFlowResponseMessage') {
    if (!node.paramsJson) {
      return ''
    }

    try {
      const parsed = JSON.parse(node.paramsJson)

      return (
        parsed.id ||
        parsed.selected_id ||
        parsed.row_id ||
        parsed.button_id ||
        parsed.command ||
        ''
      )
    } catch {
      return ''
    }
  }

  return node.caption || node.text || ''
}

const download = (sock, key, content) =>
  downloadMediaMessage(
    {
      key,
      message: content
    },
    'buffer',
    {},
    {
      logger,
      reuploadRequest: sock.updateMediaMessage
    }
  )

const normalizeNativeFlow = (nativeFlow) => {
  if (!Array.isArray(nativeFlow)) {
    return []
  }

  return nativeFlow
    .filter(
      (button) =>
        button &&
        typeof button === 'object'
    )
    .map((button) => {
      const result = {
        text: String(button.text || '')
      }

      if (button.id !== undefined) {
        result.id = String(button.id)
      }

      if (button.copy !== undefined) {
        result.copy = String(button.copy)
      }

      if (button.call !== undefined) {
        result.call = String(button.call)
      }

      if (button.url !== undefined) {
        result.url = String(button.url)

        if (button.useWebview !== undefined) {
          result.useWebview = Boolean(button.useWebview)
        }
      }

      if (Array.isArray(button.sections)) {
        result.sections = button.sections.map((section) => ({
          title: String(section.title || ''),
          ...(section.highlight_label
            ? {
                highlight_label: String(
                  section.highlight_label
                )
              }
            : {}),
          rows: Array.isArray(section.rows)
            ? section.rows.map((row) => ({
                header: String(row.header || ''),
                title: String(row.title || ''),
                description: String(row.description || ''),
                id: String(
                  row.id ??
                  row.rowId ??
                  ''
                )
              }))
            : []
        }))
      }

      if (button.icon !== undefined) {
        result.icon = String(button.icon)
      }

      return result
    })
}

const normalizeCards = (cards) => {
  if (!Array.isArray(cards)) {
    return cards
  }

  return cards.map((card) => {
    if (!card || typeof card !== 'object') {
      return card
    }

    const result = {
      ...card
    }

    if (Array.isArray(card.nativeFlow)) {
      result.nativeFlow = normalizeNativeFlow(
        card.nativeFlow
      )
    }

    return result
  })
}

const normalizeSendContent = (content) => {
  if (!content || typeof content !== 'object') {
    return content
  }

  const result = {
    ...content
  }

  if (Array.isArray(result.nativeFlow)) {
    result.nativeFlow = normalizeNativeFlow(
      result.nativeFlow
    )
  }

  if (Array.isArray(result.cards)) {
    result.cards = normalizeCards(result.cards)
  }

  if (Array.isArray(result.buttons)) {
    result.buttons = result.buttons.map((button) => {
      if (!button || typeof button !== 'object') {
        return button
      }

      const item = {
        ...button
      }

      if (Array.isArray(item.sections)) {
        item.sections = item.sections.map((section) => ({
          ...section,
          rows: Array.isArray(section.rows)
            ? section.rows.map((row) => ({
                ...row,
                id: String(
                  row.id ??
                  row.rowId ??
                  ''
                )
              }))
            : []
        }))
      }

      return item
    })
  }

  return result
}

const buildMessage = (sock, key, message) => {
  const content = unwrap(message)
  const type = getType(content)
  const node = content[type]
  const isMedia = mediaTypes.includes(type)

  return {
    key,
    content,
    type,
    body: extractBody(type, content),
    isMedia,
    mimetype: isMedia
      ? node.mimetype || ''
      : '',
    fileName:
      type === 'documentMessage'
        ? node.fileName || ''
        : '',
    contextInfo:
      node && typeof node === 'object'
        ? node.contextInfo || null
        : null,
    download: async () => {
      if (!isMedia) {
        throw new Error('Pesan ini bukan media')
      }

      return download(
        sock,
        key,
        content
      )
    }
  }
}

const serialize = (sock, raw) => {
  const key = raw.key
  const chat = key.remoteJid
  const isGroup = chat.endsWith('@g.us')
  const fromMe = Boolean(key.fromMe)

  const bots = [
    toNumber(sock.user && sock.user.id),
    toNumber(sock.user && sock.user.lid)
  ].filter(Boolean)

  const base = buildMessage(
    sock,
    key,
    raw.message
  )

  const sender = fromMe
    ? (sock.user && sock.user.id) || ''
    : isGroup
      ? key.participant || raw.participant || ''
      : chat

  const senderAlt =
    (isGroup
      ? key.participantAlt
      : key.remoteJidAlt) || ''

  const info = base.contextInfo

  let quoted = null

  if (info && info.quotedMessage) {
    const quotedSender =
      info.participant ||
      (isGroup ? '' : chat)

    const quotedKey = {
      remoteJid: chat,
      id: info.stanzaId,
      participant:
        info.participant || undefined,
      fromMe: bots.includes(
        toNumber(info.participant)
      )
    }

    quoted = {
      ...buildMessage(
        sock,
        quotedKey,
        info.quotedMessage
      ),
      sender: quotedSender
    }
  }

  return {
    ...base,
    raw,
    id: key.id,
    chat,
    isGroup,
    fromMe,
    sender,
    senderAlt,
    pushName: raw.pushName || '',
    mentions:
      (info && info.mentionedJid) || [],
    quoted,

    reply: (text, extra = {}) =>
      sock.sendMessage(
        chat,
        {
          text,
          ...extra
        },
        {
          quoted: raw
        }
      ),

    send: (content, options = {}) =>
      sock.sendMessage(
        chat,
        normalizeSendContent(content),
        {
          quoted: raw,
          ...options
        }
      )
  }
}

const resolveNumbers = async (sock, m) => {
  const ids = [
    m.sender,
    m.senderAlt
  ].filter(Boolean)

  const numbers = new Set(
    ids.map(toNumber)
  )

  const lid = ids.find(
    (id) => id.endsWith('@lid')
  )

  if (lid && !m.senderAlt) {
    if (!lidCache.has(lid)) {
      try {
        const result =
          await sock.findUserId(lid)

        if (
          result &&
          result.phoneNumber
        ) {
          lidCache.set(
            lid,
            toNumber(result.phoneNumber)
          )
        }
      } catch {}
    }

    if (lidCache.has(lid)) {
      numbers.add(
        lidCache.get(lid)
      )
    }
  }

  return [
    ...numbers
  ].filter(Boolean)
}

async function resolveJid(sock, number) {
  const clean = String(number)
    .replace(/\D/g, '')

  if (!clean) return null

  const result = await sock.onWhatsApp(
    `${clean}@s.whatsapp.net`
  ).catch(() => [])

  const found = result?.find(v => v.exists)

  return found?.jid || null
}

const createAccess = (sock, m) => {
  let cache

  return async () => {
    if (!cache) {
      const numbers =
        await resolveNumbers(
          sock,
          m
        )

      const isOwner =
        m.fromMe ||
        isOwnerAny(numbers)

      const isPremium =
        isOwner ||
        Boolean(
          findPremium(numbers)
        )

      cache = {
        numbers,
        isOwner,
        isPremium
      }
    }

    return cache
  }
}

const getTarget = (m, args = []) => {
  const typed = args
    .map(toNumber)
    .find(
      (v) =>
        v.length >= 5 &&
        v.length <= 16
    )

  if (typed) {
    return typed
  }

  if (m.mentions.length) {
    return toNumber(
      m.mentions[0]
    )
  }

  if (m.quoted && m.quoted.sender) {
    return toNumber(
      m.quoted.sender
    )
  }

  return ''
}

const mediaPayload = (msg, buffer) => {
  const node = msg.content[msg.type]

  switch (msg.type) {
    case 'imageMessage':
      return {
        image: buffer,
        caption: node.caption || ''
      }

    case 'videoMessage':
      return {
        video: buffer,
        caption: node.caption || '',
        gifPlayback: Boolean(
          node.gifPlayback
        )
      }

    case 'audioMessage':
      return {
        audio: buffer,
        mimetype:
          node.mimetype ||
          'audio/mpeg',
        ptt: Boolean(node.ptt)
      }

    case 'stickerMessage':
      return {
        sticker: buffer
      }

    default:
      return {
        document: buffer,
        mimetype:
          node.mimetype ||
          'application/octet-stream',
        fileName:
          node.fileName ||
          'file',
        caption:
          node.caption || ''
      }
  }
}

const crc32 = (buffer) => {
  let c = 0xffffffff

  for (
    let i = 0;
    i < buffer.length;
    i++
  ) {
    c =
      crcTable[
        (c ^ buffer[i]) & 0xff
      ] ^
      (c >>> 8)
  }

  return (
    c ^
    0xffffffff
  ) >>> 0
}

const pngChunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)

  const body = Buffer.concat([
    Buffer.from(type, 'ascii'),
    data
  ])

  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(
    crc32(body)
  )

  return Buffer.concat([
    length,
    body,
    crc
  ])
}

const solidImage = (
  width = 512,
  height = 288,
  color = [255, 140, 0]
) => {
  const cacheKey =
    `${width}x${height}:${color.join(',')}`

  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)
  }

  const header = Buffer.alloc(13)

  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)

  header[8] = 8
  header[9] = 2

  const row = Buffer.alloc(
    1 + width * 3
  )

  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = color[0]
    row[2 + x * 3] = color[1]
    row[3 + x * 3] = color[2]
  }

  const raw = Buffer.alloc(
    row.length * height
  )

  for (let y = 0; y < height; y++) {
    row.copy(
      raw,
      y * row.length
    )
  }

  const png = Buffer.concat([
    Buffer.from([
      137,
      80,
      78,
      71,
      13,
      10,
      26,
      10
    ]),
    pngChunk(
      'IHDR',
      header
    ),
    pngChunk(
      'IDAT',
      zlib.deflateSync(raw)
    ),
    pngChunk(
      'IEND',
      Buffer.alloc(0)
    )
  ])

  imageCache.set(
    cacheKey,
    png
  )

  return png
}

const requestPairing = async (
  sock,
  number,
  custom,
  isActive
) => {
  let lastError

  for (
    let attempt = 0;
    attempt < 5;
    attempt++
  ) {
    if (!isActive()) {
      return null
    }

    try {
      await sleep(3000)

      if (!isActive()) {
        return null
      }

      const code = custom
        ? await sock.requestPairingCode(
            number,
            custom
          )
        : await sock.requestPairingCode(
            number
          )

      return String(
        code || custom
      )
        .match(/.{1,4}/g)
        .join('-')
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

const getGroup = (jid) => {
  const groups = readJSON(groupFile, {})
  return groups[jid] || {}
}

const setGroup = (jid, data) => {
  const groups = readJSON(groupFile, {})

  groups[jid] = {
    ...groups[jid],
    ...data
  }

  writeJSON(groupFile, groups)

  return groups[jid]
  }

    
 async function getGroupData(sock, m) {
  const from = m.chat || m.raw?.key?.remoteJid || ''
  const isGroup = from.endsWith('@g.us')

  if (!isGroup) {
    return {
      isGroup: false,
      sender: m.sender || from,
      senderAlt: m.senderAlt || '',
      groupMetadata: null,
      groupName: '',
      participants: [],
      groupAdmin: [],
      groupOwner: '',
      groupMember: [],
      isBotAdmin: false,
      isBotGroupAdmin: false,
      isGroupAdmin: false,
      isAdmin: false
    }
  }

  const groupMetadata = await sock.groupMetadata(from).catch(() => null)
  const participants = groupMetadata?.participants || []

  const sender = m.sender || ''
  const senderAlt = m.senderAlt || ''

  const senderIds = [
    sender,
    senderAlt,
    m.raw?.key?.participant,
    m.raw?.key?.participantAlt
  ]
    .filter(Boolean)
    .map(toNumber)
    .filter(Boolean)

  const groupAdmin = participants
    .filter(v =>
      v.admin === 'admin' ||
      v.admin === 'superadmin'
    )
    .map(v => v.id)
    .filter(Boolean)

  const adminIds = participants
    .filter(v =>
      v.admin === 'admin' ||
      v.admin === 'superadmin'
    )
    .flatMap(v => [
      v.id,
      v.lid,
      v.jid,
      v.phoneNumber
    ])
    .filter(Boolean)
    .map(toNumber)
    .filter(Boolean)

  const botIds = [
    sock.user?.id,
    sock.user?.lid
  ]
    .filter(Boolean)
    .map(toNumber)
    .filter(Boolean)

  const isGroupAdmin =
    senderIds.some(id =>
      adminIds.includes(id)
    )

  const isBotAdmin =
    botIds.some(id =>
      adminIds.includes(id)
    )

  return {
    isGroup: true,
    sender,
    senderAlt,
    groupMetadata,
    groupName: groupMetadata.subject || '',
    participants,
    groupAdmin,
    groupOwner: groupMetadata.owner || '',
    groupMember: participants,
    isBotAdmin,
    isBotGroupAdmin: isBotAdmin,
    isGroupAdmin,
    isAdmin: isGroupAdmin
  }
}
     
module.exports = {
  sleep,
  ask,
  toNumber,
  hasPrefix,
  initDB,
  getOwners,
  addOwner,
  delOwner,
  getPremium,
  addPremium,
  delPremium,
  findPremium,
  parseDuration,
  formatDuration,
  formatDate,
  serialize,
  createAccess,
  getTarget,
  mediaPayload,
  solidImage,
  requestPairing,
  resolveJid,
  getGroup,
  setGroup,
  getGroupData
                                         }

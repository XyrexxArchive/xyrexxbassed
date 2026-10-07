const lib = require('./lib/function')

const P = global.prefix[0]

const mediaMap = {
  getimage: 'imageMessage',
  getvideo: 'videoMessage',
  getaudio: 'audioMessage',
  getsticker: 'stickerMessage',
  getfile: 'documentMessage'
}

const section = (title, commands) => [`*${title}*`, ...commands.map((c) => `• ${P}${c}`), '']

const menuText = (name) =>
  [
    `Halo ${name}, selamat datang di *${global.botName}*`,
    '',
    ...section('Main', ['menu', 'ping', 'runtime', 'owner', 'cekprem', 'myid']),
    ...section('Premium', ['vip']),
    ...section('Owner', ['addowner', 'delowner', 'listowner', 'addprem', 'delprem', 'listprem', 'self', 'public']),
    ...section('Group', [
  'groupmenu',
  'groupinfo',
  'creategroup',
  'add',
  'kick',
  'promote',
  'demote',
  'tagall',
  'hidetag',
  'setname',
  'setdesc',
  'open',
  'close',
  'lock',
  'unlock',
  'memberadd',
  'memberall',
  'linkgroup',
  'resetlink',
  'join',
  'leave',
  'requests',
  'approve',
  'reject',
  'ephemeral',
  'upswgc'
])
  ]
    .join('\n')
    .trim()

const row = (title, description, command) => ({
  header: '',
  title,
  description,
  id: `${P}${command}`
})

const menuSections = [
  {
    title: 'Main',
    rows: [
      row('Ping', 'Cek respon bot', 'ping'),
      row('Runtime', 'Waktu aktif bot', 'runtime'),
      row('Owner', 'Kontak owner', 'owner'),
      row('Self', 'Hanya Penggunaan Pribadi Akses Bot', 'self'),
      row('Public', 'Semua Pengguna Bisa Akses Bot'),
      row('Cek Premium', 'Status akun kamu', 'cekprem')
    ]
  },
  {
  title: 'Group',
  rows: [
    row('Group Menu', 'Daftar fitur group', 'groupmenu'),
    row('Group Info', 'Informasi group', 'groupinfo'),
    row('Create Group', 'Membuat group baru', 'creategroup'),
    row('Add', 'Menambahkan member', 'add'),
    row('Kick', 'Mengeluarkan member', 'kick'),
    row('Promote', 'Menjadikan admin', 'promote'),
    row('Demote', 'Menurunkan admin', 'demote'),
    row('Tag All', 'Mention semua member', 'tagall'),
    row('Hide Tag', 'Mention tanpa menampilkan tag', 'hidetag'),
    row('Set Name', 'Mengubah nama group', 'setname'),
    row('Set Description', 'Mengubah deskripsi group', 'setdesc'),
    row('Open', 'Membuka group', 'open'),
    row('Close', 'Menutup group', 'close'),
    row('Lock', 'Membatasi edit group', 'lock'),
    row('Unlock', 'Membuka edit group', 'unlock'),
    row('Member Add', 'Atur izin tambah member', 'memberadd'),
    row('Member All', 'Atur izin kirim pesan', 'memberall'),
    row('Link Group', 'Mengambil link group', 'linkgroup'),
    row('Reset Link', 'Reset link group', 'resetlink'),
    row('Join', 'Join menggunakan link', 'join'),
    row('Leave', 'Keluar dari group', 'leave'),
    row('Requests', 'Lihat permintaan join', 'requests'),
    row('Approve', 'Menyetujui permintaan join', 'approve'),
    row('Reject', 'Menolak permintaan join', 'reject'),
    row('Ephemeral', 'Atur pesan sementara', 'ephemeral'),
    row('Anti Tag SW', 'Anti mention Status WhatsApp', 'antitagsw'),
    row('Upload Sw Gc', 'Upload Status Whatsapp Group', 'upswgc')
  ]
 }
]

module.exports = async (sock, m) => {
  const used = global.prefix.find((p) => m.body.startsWith(p))
  if (!used) return

  const [name = '', ...args] = m.body.slice(used.length).trim().split(/\s+/)
  const command = name.toLowerCase()
  if (!command) return

  const access = lib.createAccess(sock, m)

  const kampang = async (content, fallback) => {
    try {
      return await m.send(content)
    } catch (error) {
      console.error(error)
      return m.reply(fallback)
    }
  }

  try {
    switch (command) {
      case 'menu':
      case 'help': {
        const text = menuText(m.pushName || 'kak')

        await kampang(
          {
            text,
            footer: global.footer,
            buttonText: 'Pilih Menu',
            title: global.botName,
            sections: menuSections.map((s) => ({
              title: s.title,
              rows: s.rows.map((r) => ({
                title: r.title,
                description: r.description,
                rowId: r.id
              }))
            }))
          },
          menuText(m.pushName || 'kak')
        )
        break
      }

      case 'ping': {
        const start = Date.now()
        const sent = await m.reply('Mengukur respon...')
        await sock.sendMessage(m.chat, {
          text: `Pong! Respon ${Date.now() - start} ms`,
          edit: sent.key
        })
        break
      }

      case 'runtime': {
        await m.reply(`Runtime: ${lib.formatDuration(process.uptime() * 1000)}`)
        break
      }

      case 'owner': {
        const numbers = (global.owner || []).map(lib.toNumber).filter(Boolean)

        if (!numbers.length) {
          return m.reply('Kontak owner belum diatur.')
        }

        const contacts = numbers.map((num, i) => ({
          vcard: [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${global.ownerName}${numbers.length > 1 ? ` ${i + 1}` : ''}`,
            `TEL;type=CELL;type=VOICE;waid=${num}:+${num}`,
            'END:VCARD'
          ].join('\n')
        }))

        await m.send({
          contacts: {
            displayName: global.ownerName,
            contacts
          }
        })
        break
      }

      case 'myid': {
        const { numbers, isOwner, isPremium } = await access()

        await m.reply(
          [
            `Chat: ${m.chat}`,
            `Sender: ${m.sender}`,
            m.senderAlt && `Sender Alt: ${m.senderAlt}`,
            `Nomor: ${numbers.join(', ') || '-'}`,
            `Owner: ${isOwner ? 'Ya' : 'Bukan'}`,
            `Premium: ${isPremium ? 'Ya' : 'Bukan'}`
          ]
            .filter(Boolean)
            .join('\n')
        )
        break
      }

      case 'cekprem': {
        const { numbers, isOwner } = await access()
        const entry = lib.findPremium(numbers)

        const status = isOwner
          ? 'Owner (akses penuh)'
          : entry
            ? entry.expired
              ? `Premium sampai ${lib.formatDate(entry.expired)}`
              : 'Premium permanen'
            : 'Free'

        await m.reply(`Status akun: ${status}`)
        break
      }

      case 'vip': {
        const { isPremium } = await access()

        if (!isPremium) {
          return m.reply(global.mess.premium)
        }

        await m.reply('Fitur premium aktif. Tambahkan fitur khusus premium di sini.')
        break
      }

      case 'addowner': {
        const { isOwner } = await access()

        if (!isOwner) {
          return m.reply(global.mess.owner)
        }

        const target = lib.getTarget(m, args)

        if (!target) {
          return m.reply(`Contoh: ${used}addowner 628xxxxxxxxxx atau reply/tag pengguna`)
        }

        const result = lib.addOwner(target)

        return m.reply(
          result === 'added'
            ? `${target} berhasil ditambahkan sebagai owner.`
            : `${target} sudah menjadi owner.`
        )
      }

      case 'delowner': {
        const { isOwner } = await access()

        if (!isOwner) {
          return m.reply(global.mess.owner)
        }

        const target = lib.getTarget(m, args)

        if (!target) {
          return m.reply(`Contoh: ${used}delowner 628xxxxxxxxxx atau reply/tag pengguna`)
        }

        const result = lib.delOwner(target)

        const replies = {
          removed: `${target} berhasil dihapus dari owner.`,
          main: `${target} adalah owner utama dari setting.js dan tidak bisa dihapus lewat command.`,
          missing: `${target} tidak ada di daftar owner.`
        }

        return m.reply(replies[result])
      }

      case 'listowner': {
        const { isOwner } = await access()

        if (!isOwner) {
          return m.reply(global.mess.owner)
        }

        const list = lib.getOwners()

        return m.reply(
          `*Daftar Owner*\n${list.map((v, i) => `${i + 1}. ${v}`).join('\n') || '-'}`
        )
      }

      case 'self': {
  const { isOwner } = await access()

  if (!isOwner) {
    return m.reply(global.mess.owner)
  }

  sock.public = false

  return m.reply('Mode self berhasil diaktifkan.')
}

case 'public': {
  const { isOwner } = await access()

  if (!isOwner) {
    return m.reply(global.mess.owner)
  }

  sock.public = true

  return m.reply('Mode public berhasil diaktifkan.')
}

case 'mode': {
  return m.reply(
    `Mode bot saat ini: *${sock.public ? 'public' : 'self'}*`
  )
}
break
      case 'addprem': {
        const { isOwner } = await access()

        if (!isOwner) {
          return m.reply(global.mess.owner)
        }

        const target = lib.getTarget(m, args)

        if (!target) {
          return m.reply(
            `Contoh: ${used}addprem 628xxxxxxxxxx 30d\nSatuan: s, m, h, d, w, y. Tanpa durasi berarti permanen.`
          )
        }

        const durationArg = args.find((a) => /^\d+[smhdwy]$/i.test(a))
        const expired = lib.addPremium(
          target,
          durationArg ? lib.parseDuration(durationArg) : 0
        )

        return m.reply(
          `Premium ${target} aktif ${expired ? `sampai ${lib.formatDate(expired)}` : 'permanen'}.`
        )
      }

      case 'delprem': {
        const { isOwner } = await access()

        if (!isOwner) {
          return m.reply(global.mess.owner)
        }

        const target = lib.getTarget(m, args)

        if (!target) {
          return m.reply(`Contoh: ${used}delprem 628xxxxxxxxxx atau reply/tag pengguna`)
        }

        return m.reply(
          lib.delPremium(target)
            ? `Premium ${target} berhasil dihapus.`
            : `${target} bukan pengguna premium.`
        )
      }

      case 'listprem': {
        const { isOwner } = await access()

        if (!isOwner) {
          return m.reply(global.mess.owner)
        }

        const list = lib.getPremium()

        const lines = list.map(
          (v, i) =>
            `${i + 1}. ${v.id} - ${v.expired ? lib.formatDate(v.expired) : 'permanen'}`
        )

        return m.reply(`*Daftar Premium*\n${lines.join('\n') || '-'}`)
      }

      case 'quoted':
      case 'q': {
        const q = m.quoted

        if (!q) {
          return m.reply('Reply sebuah pesan terlebih dahulu.')
        }

        const lines = [
          `Tipe: ${q.type || '-'}`,
          `Pengirim: ${q.sender || '-'}`,
          `Media: ${q.isMedia ? 'Ya' : 'Tidak'}`
        ]

        if (q.mimetype) lines.push(`Mimetype: ${q.mimetype}`)
        if (q.fileName) lines.push(`Nama file: ${q.fileName}`)
        if (q.body) lines.push(`Isi: ${q.body.slice(0, 500)}`)

        return m.reply(lines.join('\n'))
      }

      case 'getmedia':
      case 'getimage':
      case 'getvideo':
      case 'getaudio':
      case 'getsticker':
      case 'getfile': {
        const wanted = mediaMap[command]

        const target = [m.quoted, m].find(
          (v) =>
            v &&
            v.isMedia &&
            (!wanted || v.type === wanted)
        )

        if (!target) {
          return m.reply(
            'Reply media yang sesuai (gambar, video, audio, stiker, atau file) atau kirim media dengan caption command.'
          )
        }

        const buffer = await target.download()
        await m.send(lib.mediaPayload(target, buffer))
        break
      }

      case 'buttons':
      case 'btn': {
        await kampang(
          {
            text: 'Contoh Buttons',
            footer: global.footer,
            buttons: [
              { text: 'Ping', id: `${P}ping` },
              { text: 'Owner', id: `${P}owner` },
              { text: 'Menu', id: `${P}menu` }
            ]
          },
          `Contoh Buttons\n\n${P}ping\n${P}owner\n${P}menu`
        )
        break
      }

      case 'list': {
        if (m.isGroup) {
          return m.reply('Fitur list hanya bisa digunakan di chat pribadi.')
        }

        await kampang(
          {
            text: 'Contoh List',
            footer: global.footer,
            buttonText: 'Pilih Menu',
            title: global.botName,
            sections: menuSections.map((s) => ({
              title: s.title,
              rows: s.rows.map((r) => ({
                title: r.title,
                description: r.description,
                rowId: r.id
              }))
            }))
          },
          menuText(m.pushName || 'kak')
        )
        break
      }

      

      case 'airich': {
        await kampang(
          {
            disclaimerText: global.botName,
            richResponse: [
              { text: 'Contoh AI Rich Response' },
              {
                language: 'javascript',
                code: [
                  {
                    highlightType: 0,
                    codeContent: 'console.log("Hello, World!")'
                  }
                ]
              },
              { text: 'Perbandingan runtime JavaScript' },
              {
                title: 'Runtime Comparison',
                table: [
                  {
                    isHeading: true,
                    items: ['', 'Node.js', 'Bun', 'Deno']
                  },
                  {
                    isHeading: false,
                    items: ['Engine', 'V8', 'JavaScriptCore', 'V8']
                  },
                  {
                    isHeading: false,
                    items: ['Performa', '4/5', '5/5', '4/5']
                  }
                ]
              },
              { text: 'Selesai.' }
            ]
          },
          'AI Rich tidak dapat dikirim di versi WhatsApp ini.'
        )
        break
      }

      case 'aicode': {
        await kampang(
          {
            disclaimerText: global.botName,
            headerText: '## Contoh Code Block',
            contentText: '---',
            code: 'console.log("Hello, World!")',
            language: 'javascript',
            footerText: global.botName
          },
          'AI Code tidak dapat dikirim di versi WhatsApp ini.'
        )
        break
      }

      case 'aitable': {
        await kampang(
          {
            disclaimerText: global.botName,
            headerText: '## Perbandingan Node.js, Bun, dan Deno',
            contentText: '---',
            title: 'Runtime Comparison',
            table: [
              ['', 'Node.js', 'Bun', 'Deno'],
              ['Engine', 'V8', 'JavaScriptCore', 'V8'],
              ['Performa', '4/5', '5/5', '4/5']
            ],
            footerText: global.botName
          },
          'AI Table tidak dapat dikirim di versi WhatsApp ini.'
        )
        break
      }

      case 'ailinks': {
        await kampang(
          {
            disclaimerText: global.botName,
            headerText: '## Link Pilihan',
            contentText: '---',
            links: [
              {
                text: '1. Google',
                title: 'Mesin pencari',
                url: 'https://www.google.com/'
              },
              {
                text: '2. YouTube',
                title: 'Platform video',
                url: 'https://www.youtube.com/'
              },
              {
                text: '3. Baileys Fork',
                title: 'Library bot ini',
                url: global.website
              }
            ],
            footerText: global.botName
          },
          `Link Pilihan\n1. https://www.google.com/\n2. https://www.youtube.com/\n3. ${global.website}`
        )
        break
      }
     case 'groupmenu': {
  await m.reply([
    `*${global.botName} Group Menu*`,
    '',
    `${used}groupinfo`,
    `${used}creategroup`,
    `${used}add`,
    `${used}kick`,
    `${used}promote`,
    `${used}demote`,
    `${used}tagall`,
    `${used}hidetag`,
    `${used}setname`,
    `${used}setdesc`,
    `${used}open`,
    `${used}close`,
    `${used}lock`,
    `${used}unlock`,
    `${used}memberadd`,
    `${used}memberall`,
    `${used}linkgroup`,
    `${used}resetlink`,
    `${used}join`,
    `${used}leave`,
    `${used}requests`,
    `${used}approve`,
    `${used}reject`,
    `${used}ephemeral`,
    `${used}antitagsw`
  ].join('\n'))
  break
}

case 'groupinfo': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const metadata = await sock.groupMetadata(m.chat)

  const admins = metadata.participants.filter(
    (p) =>
      p.admin === 'admin' ||
      p.admin === 'superadmin'
  )

  const group = lib.getGroup(m.chat)

  await m.reply([
    '*Group Information*',
    '',
    `Nama: ${metadata.subject || '-'}`,
    `ID: ${metadata.id}`,
    `Member: ${metadata.participants.length}`,
    `Admin: ${admins.length}`,
    `Owner: ${metadata.owner || '-'}`,
    `Deskripsi: ${metadata.desc || '-'}`,
    `Mode Chat: ${metadata.announce ? 'Admin' : 'Semua Member'}`,
    `Edit Info: ${metadata.restrict ? 'Admin' : 'Semua Member'}`,
    `Approval: ${metadata.joinApprovalMode ? 'ON' : 'OFF'}`,
    `Anti Tag SW: ${group.antitagsw ? 'ON' : 'OFF'}`
  ].join('\n'))
  break
}

case 'creategroup':
case 'buatgc': {
  const title = args
    .filter((v) => !/^\d{5,16}$/.test(v))
    .join(' ')
    .trim()

  const numbers = args
    .filter((v) => /^\d{5,16}$/.test(v))
    .map((v) => `${v}@s.whatsapp.net`)

  if (!title || !numbers.length) {
    return m.reply(
      `Contoh:\n${used}creategroup Nama Group 628123456789`
    )
  }

  const group = await sock.groupCreate(
    title,
    numbers
  )

  await m.reply([
    'Group berhasil dibuat.',
    '',
    `Nama: ${group.subject || title}`,
    `ID: ${group.id}`
  ].join('\n'))

  break
}

case 'add': {
  if (!m.isGroup) return m.reply('Command ini hanya bisa digunakan di group.')

  const { isAdmin, isBotAdmin } = await lib.getGroupData(sock, m)

  if (!isAdmin) return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  if (!isBotAdmin) return m.reply('Bot harus menjadi admin group terlebih dahulu.')

  const number = args.join('').replace(/\D/g, '')

  if (!number) {
    return m.reply(`Contoh:\n${used}add 628xxxxxxxxxx`)
  }

  const jid = `${number}@s.whatsapp.net`

  try {
    const result = await sock.groupParticipantsUpdate(
      m.chat,
      [jid],
      'add'
    )

    console.dir(result, { depth: null })

    const item = result?.[0]

    if (item?.status === '200') {
      return m.reply(`Berhasil menambahkan ${number}`)
    }

    if (item?.status === '403') {
      return m.reply(
        `WhatsApp menolak penambahan ${number} (403).`
      )
    }

    return m.reply(
      `Gagal menambahkan ${number}.\nStatus: ${item?.status || 'unknown'}`
    )
  } catch (e) {
    console.error(e)
    return m.reply(`Gagal: ${e?.message || e}`)
  }
}
break

case 'kick':
case 'remove': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  const targets = [
    ...m.mentions,
    ...(m.quoted?.sender ? [m.quoted.sender] : [])
  ]

  if (!targets.length) {
    return m.reply(
      `Tag atau reply member yang ingin dikeluarkan.`
    )
  }

  await sock.groupParticipantsUpdate(
    m.chat,
    [...new Set(targets)],
    'remove'
  )

  await m.reply(
    `${targets.length} member berhasil diproses.`
  )

  break
}

case 'promote': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  const targets = [
    ...m.mentions,
    ...(m.quoted?.sender ? [m.quoted.sender] : [])
  ]

  if (!targets.length) {
    return m.reply(
      `Contoh:\n${used}promote @user`
    )
  }

  await sock.groupParticipantsUpdate(
    m.chat,
    [...new Set(targets)],
    'promote'
  )

  await m.reply(
    `${targets.length} member berhasil dijadikan admin.`
  )

  break
}

case 'demote': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  const targets = [
    ...m.mentions,
    ...(m.quoted?.sender ? [m.quoted.sender] : [])
  ]

  if (!targets.length) {
    return m.reply(
      `Contoh:\n${used}demote @user`
    )
  }

  await sock.groupParticipantsUpdate(
    m.chat,
    [...new Set(targets)],
    'demote'
  )

  await m.reply(
    `${targets.length} admin berhasil diturunkan.`
  )

  break
}

case 'tagall': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const metadata = await sock.groupMetadata(m.chat)

  const mentions = metadata.participants.map(
    (p) => p.id
  )

  const text = args.length
    ? args.join(' ')
    : 'Tag all member'

  await sock.sendMessage(m.chat, {
    text,
    mentions
  })

  break
}

case 'hidetag': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const metadata = await sock.groupMetadata(m.chat)

  const mentions = metadata.participants.map(
    (p) => p.id
  )

  const text = args.length
    ? args.join(' ')
    : 'Hidden tag'

  await sock.sendMessage(m.chat, {
    text,
    mentions
  })

  break
}

case 'setname':
case 'setsubject': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  const name = args.join(' ').trim()

  if (!name) {
    return m.reply(
      `Contoh:\n${used}setname Nama Group Baru`
    )
  }

  await sock.groupUpdateSubject(
    m.chat,
    name
  )

  await m.reply(
    `Nama group berhasil diubah menjadi ${name}.`
  )

  break
}

case 'setdesc':
case 'setdescription': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  const description = args.join(' ').trim()

  if (!description) {
    return m.reply(
      `Contoh:\n${used}setdesc Deskripsi group`
    )
  }

  await sock.groupUpdateDescription(
    m.chat,
    description
  )

  await m.reply(
    'Deskripsi group berhasil diubah.'
  )

  break
}

case 'open': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  await sock.groupSettingUpdate(
    m.chat,
    'not_announcement'
  )

  await m.reply(
    'Group berhasil dibuka.'
  )

  break
}

case 'close': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  await sock.groupSettingUpdate(
    m.chat,
    'announcement'
  )

  await m.reply(
    'Group berhasil ditutup.'
  )

  break
}

case 'lock': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  await sock.groupSettingUpdate(
    m.chat,
    'locked'
  )

  await m.reply(
    'Info group sekarang hanya bisa diedit admin.'
  )

  break
}

case 'unlock': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  await sock.groupSettingUpdate(
    m.chat,
    'unlocked'
  )

  await m.reply(
    'Info group sekarang bisa diedit semua member.'
  )

  break
}

case 'memberadd': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  await sock.groupMemberAddMode(
    m.chat,
    'admin_add'
  )

  await m.reply(
    'Sekarang hanya admin yang bisa menambahkan member.'
  )

  break
}

case 'memberall': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  await sock.groupMemberAddMode(
    m.chat,
    'all_member_add'
  )

  await m.reply(
    'Sekarang semua member bisa menambahkan member.'
  )

  break
}

case 'linkgroup':
case 'grouplink': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  const code = await sock.groupInviteCode(
    m.chat
  )

  await m.reply(
    `https://chat.whatsapp.com/${code}`
  )

  break
}

case 'resetlink': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  await sock.groupRevokeInvite(
    m.chat
  )

  const code = await sock.groupInviteCode(
    m.chat
  )

  await m.reply(
    `Link group berhasil direset.\n\nhttps://chat.whatsapp.com/${code}`
  )

  break
}

case 'join': {
  const code = args[0]
    ?.replace(
      'https://chat.whatsapp.com/',
      ''
    )
    .trim()

  if (!code) {
    return m.reply(
      `Contoh:\n${used}join https://chat.whatsapp.com/xxxxx`
    )
  }

  const groupId = await sock.groupAcceptInvite(
    code
  )

  await m.reply(
    `Berhasil bergabung ke group.\nID: ${groupId}`
  )

  break
}

case 'leave': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin
  } = await lib.getGroupData(
    sock,
    m
  )

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  await m.reply(
    'Bot akan keluar dari group.'
  )

  await sock.groupLeave(
    m.chat
  )

  break
}

case 'requests': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  const requests =
    await sock.groupRequestParticipantsList(
      m.chat
    )

  if (!requests.length) {
    return m.reply(
      'Tidak ada request join.'
    )
  }

  const text = requests
    .map(
      (v, i) =>
        `${i + 1}. ${v.jid || v.id || '-'}`
    )
    .join('\n')

  await m.reply(
    `*Pending Join Request*\n\n${text}`
  )

  break
}

case 'approve': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  const requests =
    await sock.groupRequestParticipantsList(
      m.chat
    )

  const participants = requests
    .map((v) => v.jid)
    .filter(Boolean)

  if (!participants.length) {
    return m.reply(
      'Tidak ada request join.'
    )
  }

  await sock.groupRequestParticipantsUpdate(
    m.chat,
    participants,
    'approve'
  )

  await m.reply(
    `${participants.length} request berhasil disetujui.`
  )

  break
}

case 'reject': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  const requests =
    await sock.groupRequestParticipantsList(
      m.chat
    )

  const participants = requests
    .map((v) => v.jid)
    .filter(Boolean)

  if (!participants.length) {
    return m.reply(
      'Tidak ada request join.'
    )
  }

  await sock.groupRequestParticipantsUpdate(
    m.chat,
    participants,
    'reject'
  )

  await m.reply(
    `${participants.length} request berhasil ditolak.`
  )

  break
}

case 'ephemeral': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const {
    isAdmin,
    isBotAdmin
  } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  if (!isBotAdmin) {
    return m.reply('Bot harus menjadi admin group terlebih dahulu.')
  }

  const value = args[0]?.toLowerCase()

  const durations = {
    '1d': 86400,
    '7d': 604800,
    '90d': 7776000,
    off: 0
  }

  if (!(value in durations)) {
    return m.reply(
      [
        '*Ephemeral*',
        '',
        `${used}ephemeral 1d`,
        `${used}ephemeral 7d`,
        `${used}ephemeral 90d`,
        `${used}ephemeral off`
      ].join('\n')
    )
  }

  await sock.groupToggleEphemeral(
    m.chat,
    durations[value]
  )

  await m.reply(
    value === 'off'
      ? 'Pesan sementara berhasil dinonaktifkan.'
      : `Pesan sementara berhasil diatur ${value}.`
  )

  break
}
  
   case 'upswgc': {
  if (!m.isGroup) {
    return m.reply('Command ini hanya bisa digunakan di group.')
  }

  const { isAdmin } = await lib.getGroupData(sock, m)

  if (!isAdmin) {
    return m.reply('Command ini hanya bisa digunakan oleh admin group.')
  }

  const quoted = m.quoted

  if (!quoted) {
    return m.reply(`Reply foto/video dengan ${used}upswgc`)
  }

  const mime = quoted.mimetype || quoted.msg?.mimetype || ''

  if (!/^video\//i.test(mime) && !/^image\//i.test(mime)) {
    return m.reply('Media yang didukung hanya foto atau video.')
  }

  try {
    const buffer = await quoted.download()

    if (!buffer) {
      return m.reply('Gagal mengambil media.')
    }

    const caption = args.join(' ').trim()

    if (/^video\//i.test(mime)) {
      await sock.sendMessage(m.chat, {
        video: buffer,
        caption,
        groupStatus: true
      })
    } else {
      await sock.sendMessage(m.chat, {
        image: buffer,
        caption,
        groupStatus: true
      })
    }

    return m.reply('Berhasil mengunggah status grup.')
  } catch (e) {
    console.error('[UPSWGC]', e)
    return m.reply(`Gagal mengunggah status grup.\n${e?.message || e}`)
  }
}
break      
      default:
        break
    }
  } catch (error) {
    console.error(error)
    await m.reply(global.mess.error)
  }
}

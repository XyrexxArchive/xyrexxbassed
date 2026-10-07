require('./setting')
const fs = require('fs')
const path = require('path')
const pino = require('pino')
const {
  makeWASocket,
  delay,
  DisconnectReason,
  useMultiFileAuthState
} = require('@itsliaaa/baileys')
const lib = require('./lib/function')

const logger = pino({ level: 'silent' })
const sessionPath = path.join(__dirname, global.sessionName)
const casePath = require.resolve('./xyr')

let pairingNumber = lib.toNumber(global.pairingNumber)

fs.watchFile(casePath, { interval: 1000 }, () => {
  delete require.cache[casePath]
  console.log('xyr.js dimuat ulang')
})

process.on('unhandledRejection', (error) => console.error(error))
process.on('uncaughtException', (error) => console.error(error))

const connectToWhatsApp = async () => {
  lib.initDB()

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  while (
    !state.creds.registered &&
    pairingNumber.length < 8
  ) {
    pairingNumber = lib.toNumber(
      await lib.ask(
        'Masukkan nomor WhatsApp (contoh 628xxxxxxxxxx): '
      )
    )
  }

  let active = true

  const sock = makeWASocket({
    logger,
    auth: state
  })
   
  sock.public = true
  sock.ev.on('creds.update', saveCreds)

  sock.ev.on(
    'connection.update',
    async ({
      connection,
      lastDisconnect
    }) => {
      if (connection === 'open') {
        console.log(
          `${global.botName} terhubung sebagai ${lib.toNumber(sock.user.id)}`
        )
        return
      }

      if (connection !== 'close') return

      active = false

      const statusCode =
        lastDisconnect &&
        lastDisconnect.error &&
        lastDisconnect.error.output
          ? lastDisconnect.error.output.statusCode
          : undefined

      if (
        statusCode ===
        DisconnectReason.loggedOut
      ) {
        fs.rmSync(
          sessionPath,
          {
            recursive: true,
            force: true
          }
        )

        console.log(
          'Sesi logout, sesi dihapus dan koneksi diulang'
        )
      } else if (
        statusCode ===
        DisconnectReason.connectionReplaced
      ) {
        console.log(
          'Sesi dipakai di perangkat lain, bot dihentikan'
        )

        process.exit(1)
      } else {
        console.log(
          `Koneksi terputus (${statusCode || 'unknown'}), menghubungkan ulang`
        )
      }

      await delay(2000)
      connectToWhatsApp()
    }
  )

  sock.ev.on(
    'messages.upsert',
    async ({
      messages,
      type
    }) => {
      if (type !== 'notify') return

      for (const raw of messages) {
        try {
          if (
            !raw.message ||
            !raw.key ||
            !raw.key.remoteJid
          ) {
            continue
          }
          
          if (
        !sock.public &&
        !raw.key.fromMe
      ) {
        continue
      }
          const jid = raw.key.remoteJid

          if (
            jid === 'status@broadcast' ||
            jid.endsWith('@newsletter') ||
            jid.endsWith('@broadcast')
          ) {
            continue
          }

          const m = lib.serialize(
            sock,
            raw
          )

          if (
            m.isGroup &&
            m.type === 'statusMentionMessage'
          ) {
            const group = lib.getGroup(
              m.chat
            )

            if (group.antitagsw) {
              const {
                isAdmin,
                isBotAdmin
              } = await lib.getGroupAdmin(
                sock,
                m
              )

              if (
                isBotAdmin &&
                !isAdmin
              ) {
                await sock.sendMessage(
                  m.chat,
                  {
                    delete: m.key
                  }
                )

                continue
              }
            }
          }

          if (!m.body) continue

          if (
            m.fromMe &&
            !lib.hasPrefix(m.body)
          ) {
            continue
          }

          await require('./xyr')(
            sock,
            m
          )
        } catch (error) {
          console.error(error)
        }
      }
    }
  )

  if (!state.creds.registered) {
    lib
      .requestPairing(
        sock,
        pairingNumber,
        global.customPairingCode,
        () => active
      )
      .then((code) => {
        if (code) {
          console.log(
            `Kode pairing: ${code}`
          )
        }
      })
      .catch((error) => {
        console.error(
          'Gagal meminta kode pairing',
          error
        )
      })
  }
}

connectToWhatsApp()

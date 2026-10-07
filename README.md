# xyrexxbased

Base WhatsApp Bot sederhana menggunakan Node.js + Baileys.

# Features

- Pairing Code
- CommonJS
- Case System
- Button Support
- List Message
- Media Handler
- Owner & Premium
- Auto Reconnect

# Baileys

Menggunakan:

@itsliaaa/baileys

# Requirements

Node.js >= 20.19.0

# Install:

npm install

# Run:

npm start

# atau:

node index.js

# Pairing Code

Atur nomor yang ingin digunakan untuk pairing di "setting.js":

global.pairingNumber = '628xxxxxxxxxx'

Gunakan format nomor internasional tanpa "+".

Contoh:

global.pairingNumber = '6281234567890'

Untuk mengatur custom pairing code:

global.customPairingCode = 'XYREXPANEL'
// Untuk pairing code Max 8

Setelah itu jalankan bot:

npm start

Bot akan menampilkan pairing code yang dapat dimasukkan melalui WhatsApp.

# Struktur

xyrexxbased/
├── db/
│   ├── owner.json
│   └── premium.json
├── lib/
│   └── function.js
├── index.js
├── xyr.js
├── setting.js
├── package.json
└── README.md

# Credits

Base: xyrexxbased
Baileys: @itsliaaa/baileys
Runtime: Node.js

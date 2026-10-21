# Mimin Chatbot Widget - React Version

Widget chatbot yang dapat dikustomisasi untuk website dengan menggunakan React, TypeScript, dan Tailwind CSS.

## Fitur

- **Chat AI** — Streaming real-time conversation dengan AI agent
- **Remote Theme (api-credential)** — Tema widget dimuat otomatis dari endpoint api-credential (kunci `data_id[0]` pada `channel` website milik agent yang dikirim sebagai `chatbotAgentId`/`voiceAgentId`); embed script hanya perlu parameter minimal
- **Voice Call** — Integrasi voice agent (Gemini Live / OpenAI Realtime via orchestrator) untuk panggilan suara
- **Widget Type `voice-ai`** — Mode khusus panggilan: landing pulsing rings + "Tap To Initiate Call", tanpa chat input
- **Autentikasi** — Login & register customer dengan token-based auth, field adaptif via flag `loginByPhone` / `loginByPassword` / `registerByPhone` / `registerByPassword`
- **Greeting Screen** — Tampilan sambutan sebelum mulai chat
- **Dynamic Registration Fields** — Form register dinamis berdasarkan konfigurasi backend (Zod + react-hook-form)
- **Media Upload** — Multi-file attachment (maks 10 file, 25 MB/file), paste-to-attach, preview grid
- **Reply / Retry / Cancel** — Quote pesan dengan scroll-to-context, retry bubble gagal (file asli dipulihkan), optimistic status pending/sent/failed
- **Markdown Rendering** — Bold, italic, code, link dengan sanitasi DOMPurify
- **Emoji Picker & Formatting Toolbar** — Plus setting kirim Enter vs Ctrl+Enter (persist di localStorage)
- **Socket.io** — Real-time push message (endSession, reminderFired, websiteMessage)
- **Abort Controller** — Pembatalan request yang sedang berjalan
- **Session Persistence** — Token & greeting state tersimpan di localStorage
- **Tailwind CSS dengan Prefix `mimin-`** — Tidak bentrok dengan style website client
- **Framer Motion** — Animasi buka/tutup widget
- **TypeScript** — Full type safety

## Instalasi

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Penggunaan

> **Theme dimuat remote.** Sejak versi ini, `Chatbot.init()` TIDAK perlu lagi mengirim
> `theme` — widget otomatis menarik konfigurasi tampilan dari api-credential (via
> `data_id[0]` pada `channel` website milik agent yang dikirim sebagai
> `chatbotAgentId`/`voiceAgentId` — lihat section
> "Remote Theme" di bawah). Tabel theme di bawah menjelaskan
> struktur hasil mapping-nya, dan baru relevan bila Anda memakai
> `<ChatWidget config={...}>` langsung di aplikasi React (bukan embed script).

### Props ChatWidget

| Prop | Tipe | Wajib | Deskripsi |
|------|------|-------|-----------|
| `config` | `ChatbotConfig` | Tidak | Konfigurasi tema, credentials, dan tipe widget |
| `signature` | `string` | Ya | Signature dari `create-signature` (paritas alur dashboard; kirim chat memakai webhook + `x-api-key`, bukan signature) |
| `voiceName` | `string` | Tidak | Nama voice agent (diambil dari `credentials.voiceAgentId`) |
| `configErrors` | `string[]` | Tidak | Daftar error validasi konfigurasi; jika diisi, popup menampilkan kartu error |

### Credentials

| Field | Tipe | Wajib | Deskripsi |
|-------|------|-------|-----------|
| `apiKey` | `string` | Ya | API key untuk akses Mimin backend |
| `username` | `string` | Ya | Username/identifier chatbot |
| `websiteId` | `string` | Jika `widgetType: "chatbot"` | Id website runtime (penerima webhook, socket room/history) — BUKAN kunci api-credential; theme diambil dari `data_id` agent |
| `chatbotAgentId` | `string` | Jika `widgetType: "chatbot"` | ID chatbot agent (tidak tersedia di template_data, harus dari script) |
| `voiceAgentId` | `string` | Tidak | ID voice agent. Untuk `widgetType: "voice-ai"` wajib bila credential tidak punya `widget_voice_ai_agent_id` |
| `apiUrl` | `string` | Tidak | Custom API base URL |

### Theme → Button

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `backgroundColor` | `string` | Warna background button trigger |
| `textColor` | `string` | Warna teks button trigger |
| `iconSrc` | `string` | URL icon pada button trigger |
| `tooltip` | `string` | Tooltip text saat hover button |

### Theme → chatWindow

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `isActiveCall` | `boolean` | Aktifkan fitur voice call |
| `enableLogin` | `boolean` | Tampilkan flow login sebelum chat |
| `enableRegister` | `boolean` | Tampilkan tombol register di auth screen |
| `enableGreating` | `boolean` | Tampilkan greeting screen sebelum chat |
| `enableMediaUpload` | `boolean` | Aktifkan upload media di chat input |
| `loginByPhone` | `boolean` | Tampilkan field phone di login (default `true`) |
| `loginByPassword` | `boolean` | Tampilkan field password di login (default `true`) |
| `registerByPhone` | `boolean` | Wajibkan field phone di register (default `true`) |
| `registerByPassword` | `boolean` | Tampilkan password + confirm di register (default `true`) |
| `width` | `string` | Lebar chat window, misal `"330px"` |
| `height` | `string` | Tinggi chat window, misal `"600px"` |

### chatWindow → header

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `backgroundColor` | `string` | Warna background header |
| `color` | `string` | Warna icon di header |
| `title` | `string` | Judul chatbot di header |
| `description` | `string` | Deskripsi di bawah judul |
| `avatarSrc` | `string` | URL avatar/logo di header & auth screen |
| `closeColorButton` | `string` | Warna tombol close |
| `voiceAIColorButton` | `string` | Warna tombol voice AI |
| `refreshColorButton` | `string` | Warna tombol refresh |

### chatWindow → body

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `backgroundColor` | `string` | Warna background area chat |

### chatWindow → userMessage

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `backgroundColor` | `string` | Warna bubble pesan user |
| `borderColor` | `string` | Warna border bubble user |
| `textColor` | `string` | Warna teks pesan user |
| `iconUrl` | `string` | URL avatar di samping pesan user |

### chatWindow → botMessage

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `backgroundColor` | `string` | Warna bubble pesan bot |
| `borderColor` | `string` | Warna border bubble bot |
| `textColor` | `string` | Warna teks pesan bot |
| `iconUrl` | `string` | URL avatar di samping pesan bot |

### chatWindow → textInput

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `backgroundColor` | `string` | Warna background input area |
| `borderColor` | `string` | Warna border input area |
| `placeholder` | `string` | Placeholder text di input |
| `sendButtonColor` | `string` | Warna tombol kirim |
| `footerText` | `string` | Teks footer di bawah input |
| `footerTextColor` | `string` | Warna teks footer |

### chatWindow → greating

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `title` | `string` | Judul di greeting screen |
| `description` | `string` | Deskripsi di greeting screen |
| `avatar` | `string` | URL avatar besar di greeting screen |
| `color` | `string` | Warna utama greeting screen (background, tombol, teks) |

### widgetType

| Nilai | Credential wajib | Deskripsi |
|-------|------------------|-----------|
| `"chatbot"` (default) | `chatbotAgentId` + `websiteId` (wajib — tidak ada auto-detect) | Mode chatbot — alur chat 1:1 dengan chatbot-ui dashboard: `POST /v1/website/webhook/{username}`, history `GET /v1/website/conversation/...`, socket room `{websiteId}-{phone}`; voice call aktif bila credential men-set `widget_enable_voice_ai` |
| `"voice-ai"` | `voiceAgentId` (fallback: `widget_voice_ai_agent_id` credential) | Mode voice only — hanya panggilan (landing + tap to call), tanpa chat |

`widgetType: "website"` sudah dihapus — nilai tersebut kini menampilkan kartu
error. Validasi ketat **tanpa fallback auto-detect dari settings**; `widgetType` selalu
eksplisit di script. Jika credential wajib kosong atau theme gagal dimuat dari
api-credential: `console.error` + popup menampilkan kartu merah
"Widget configuration error" (launcher tetap berfungsi).

## Remote Theme (api-credential)

Saat init, widget meniru alur `chatbot-ui/[username]/page.tsx` di chat-flow-3 —
semua endpoint dipanggil dari browser dengan header `x-api-key`:

1. **Signature**: `POST /v1/chatbotdata/create-signature/{username}` (disimpan di
   config store; kirim chat tidak lagi memakai signature ini).
2. **configurationTheme**: `GET /v1/account/get-widget/{username}?chatbot_agent={credentials.chatbotAgentId}`
   (fallback tanpa query bila agent tidak dikirim).
3. **Theme dari api-credential** — HANYA lewat id agent dari parameter script
   (`credentials.chatbotAgentId` / `credentials.voiceAgentId`), persis logic dashboard:
   ```
   GET /v1/chatbot-agent/get/{username}/{agentId}
     → dataId = agent.channel.find(c => c.data_type === "website").data_id[0]
       (fallback: agent.data_id string → agent._id)
   GET /v1/api-credential/get/{username}/{dataId}   ← dataId = api_credential_id
     → template_data
   ```
   Fallback berantai: `template_data` → `agentData.widget_setting` → theme dari
   `configurationTheme`. Tidak ada auto-detect agent; `credentials.websiteId`
   TIDAK pernah dipakai sebagai kunci api-credential.
4. **voiceName** hanya diambil bila `enable_voice === true`:
   `GET /v1/chatbot-agent/get/{username}/{voiceAgentId}` → `voice_ai_setting.chatbot_voice_name`,
   dan `data.enable_voice` ikut di-set dari credential.

`template_data` dari respons di-mapping penuh menjadi theme widget (identik dengan
mapping dashboard `chatbot-ui/[username]`): `widget_color`, `widget_title_color`,
`widget_icon`, `widget_title`, `widget_chatbot_name/description`,
`widget_avatar_chatbot`, `widget_header_icon_color`, `widget_button_close/voice_ai/refresh_color`,
`widget_chatbot_bubble/text_color`, `widget_human_bubble/text_color`,
`widget_greeting_title/description/avatar`, `widget_footer_text(_color)`,
`widget_enable_login/register/greeting/voice/voice_ai`, `widget_login_by_phone/password`,
`widget_register_by_phone/password`, `widget_voice_ai_agent_id`, `chat_bg_color`.

Aturan main:

- **Hasil remote selalu menang** atas inline `theme` di script (override penuh, tanpa deep-merge).
- `credentials.websiteId` bukan kunci theme — hanya dipakai runtime chat (socket room/history). Kunci api-credential adalah `channel` website milik agent (`data_id[0]`), fallback `data_id`/`_id` agent.
- Agent tanpa `data_id`/credential valid → tetap jalan dengan theme dari `configurationTheme` (`account/get-widget`), sama seperti chatbot-ui; baru kartu error bila keduanya kosong.
- voice-ai: `credentials.voiceAgentId` → fallback `widget_voice_ai_agent_id` dari credential; `voiceName` hanya dimuat saat `enable_voice === true`.
- Field template yang **belum** dipetakan (belum ada UI-nya di widget): `pre_chat_form`, `widget_session_ended_*`, `widget_initial_message_script/url`, `widget_history_limit_minutes`, `enable_sound_notification_*`, `border_radius_size`, `hide_widget_title`, varian bahasa Indonesia (`*_id`).

## Breaking Changes (refactor widgetType)

- **Theme tidak lagi dikirim di embed.** Widget menariknya remote meniru alur chatbot-ui: agent dari parameter script → `data_id` → `GET /v1/api-credential/get/{username}/{api_credential_id}`, fallback `account/get-widget`; inline `theme` di script diabaikan saat fetch remote sukses.
- **`widgetType: "website"` dihapus** — widget hanya menerima `"chatbot"` (default) dan `"voice-ai"`.
- **Mode chat memakai mekanisme dashboard chatbot-ui**: `POST /v1/website/webhook/{username}` (SSE `\n\n`), history `GET /v1/website/conversation/{username}?website_id=&phone=`, socket.io room `{websiteId}-{phone}`. Jalur lama `/chat/new-website/{username}` berbasis Signature dihapus.
- `chatbotAgentId` dan `voiceAgentId` sekarang berada di **`credentials`** (seragam dengan `websiteId`), bukan lagi field top-level `ChatbotConfig` atau prop `ChatWidget`.
- `widgetType` memiliki dua nilai: `"chatbot"` \| `"voice-ai"`, masing-masing mewajibkan credential (lihat tabel di atas).
- **Tidak ada auto-detect agent** — id untuk `chatbot-agent/get` HANYA berasal dari `credentials.chatbotAgentId` / `voiceAgentId` di script. Embed lama tanpa `widgetType` default `"chatbot"`.
- **Dukungan ElevenLabs dihapus** (`@elevenlabs/react`, layout, dan prop `voiceAgent`). Semua voice call lewat orchestrator `AgentVoiceLayout` (Gemini Live / OpenAI Realtime, ditentukan server-side).
- Payload kirim chat mengikuti bentuk dashboard: `{ sender, recipient: { id: websiteId }, message: { id, reply_to, text, media[] } }` dengan header `x-api-key` (+ `Authorization-Customer` bila login aktif).

## Alur Widget

```
Chatbot.init (apiKey, username, websiteId, chatbotAgentId [/ voiceAgentId])
  ├── validasi: apiKey/username hilang → throw; chatbot tanpa chatbotAgentId/websiteId → kartu error; widgetType "website" → kartu error (tidak didukung)
  ├── (jika ada agentId di script) GET chatbot-agent/get/{username}/{agentId} → channel website data_id[0]
  │     └── GET api-credential/get/{username}/{data_id} → template_data (fallback: widget_setting agent)
  ├── POST chatbotdata/create-signature/{username}
  ├── GET account/get-widget/{username}[?chatbot_agent={chatbotAgentId}] → configurationTheme
  │     → theme: template_data > configurationTheme > kartu error (enable_voice diset dari credential)
  └── (jika enable_voice === true) GET chatbot-agent/get/{username}/{voiceAgentId} → voiceName

Widget dibuka
  ├── widgetType = "voice-ai" → Voice Widget
  │     ├── (enableLogin) Auth Window → Sign In / Create Account
  │     └── Landing (pulsing rings + "Tap To Initiate Call") → AgentVoiceLayout, cooldown 5s
  └── widgetType = "chatbot" → Chat
        ├── Kirim pesan: POST /v1/website/webhook/{username} (SSE) + history /v1/website/conversation
        ├── Socket.io: joinRoom chatHistoryId + {websiteId}-{phone} (endSession, reminderFired, websiteMessage)
        ├── enableGreating = true → Greeting Screen → klik "Start Chat" → localStorage greeting token
        ├── enableLogin = true → Auth Window
        │     ├── Landing → Sign In / Create Account
        │     ├── Sign In → Login (phone ± password, sesuai flag) → simpan token → chat
        │     └── Create Account → Dynamic form (required/optional tabs) → password + confirm → register → balik ke Sign In
        └── Authenticated / tidak perlu login → Chat Window
              ├── Header (title, avatar, call button jika enable_voice, logout, close)
              ├── Chat Content (messages, streaming, status, reply/retry/cancel)
              ├── Chat Input (text, media upload, emoji, format, send, cancel)
              └── Voice Call (Gemini Live / OpenAI Realtime) jika isActiveCall
```

## Embed Script (untuk generator snippet di dashboard)

Widget diekspor sebagai **ES module**; CSS (`dist/chat-widget.css`) disuntik
otomatis oleh `injectStyle()` saat `Chatbot.init()` dipanggil — tidak perlu tag
`<link>` manual di halaman client. Ganti `{{...}}` dengan nilai dari form
dashboard.

### Chatbot (default)

```html
<script type="module">
  import { Chatbot } from "https://unpkg.com/mimin-chatbot-widget-react@latest/dist/chat-widget.js";

  Chatbot.init({
    widgetType: "chatbot",
    credentials: {
      apiKey: "{{API_KEY}}",
      username: "{{USERNAME}}",
      websiteId: "{{WEBSITE_ID}}",
      chatbotAgentId: "{{CHATBOT_AGENT_ID}}",
      // apiUrl: "{{API_URL}}", // opsional, default endpoint customer API
    },
  });
</script>
```

Wajib: `apiKey`, `username`, `websiteId` (penerima webhook & socket room),
`chatbotAgentId` (kunci agent → theme remote). Voice call otomatis aktif bila
api-credential agent men-set `widget_enable_voice_ai`.

### Voice AI (calls only)

```html
<script type="module">
  import { Chatbot } from "https://unpkg.com/mimin-chatbot-widget-react@latest/dist/chat-widget.js";

  Chatbot.init({
    widgetType: "voice-ai",
    credentials: {
      apiKey: "{{API_KEY}}",
      username: "{{USERNAME}}",
      // websiteId: "{{WEBSITE_ID}}", // tidak dipakai mode voice-ai
      voiceAgentId: "{{VOICE_AGENT_ID}}", // boleh dikosongkan bila api-credential punya widget_voice_ai_agent_id
    },
  });
</script>
```

Hanya panggilan (landing "Tap To Initiate Call"), tanpa chat input.

> `theme` TIDAK perlu (dan tidak akan dipakai) dikirim di embed — widget
> menariknya remote dari api-credential via `channel` website agent (lihat
> "Remote Theme"). Untuk build yang di-serve sendiri, pastikan
> `MIMIN_WIDGET_ENV` di `src/utils/styleInjector.ts` = `"production"` agar CSS
> di-inject dari URL CDN, bukan path dev relatif.

## Auth Token & Session

- Token disimpan di localStorage dengan key `mimin-token-{username}`
- Greeting state disimpan dengan key `cu-greeting-{username}`
- Token otomatis diverifikasi saat widget dimuat — jika invalid (401), token dihapus dan user diminta login ulang

## Dynamic Registration Fields

Form register mengambil field dari API `/v1/customer-field/get-by-username/{username}`. Field yang didukung:

| data_type | Input | Validasi |
|-----------|-------|----------|
| `string` | Text input | Min 1 karakter jika required |
| `number` | Number input | Harus angka |
| `boolean` | Select (Yes/No) | — |
| `date` | Date picker | Format yyyy-MM-dd |
| `password` | Password input | Min 6 karakter |

Field ditampilkan dalam dua tab:
- **Required** — field dengan `is_required: true`
- **Optional** — field dengan `is_required: false`

Password + Confirm Password selalu di bagian bawah sebelum Terms of Service.

## Error Handling

- Error login ditampilkan di UI dengan pesan dari backend (misal: `"Your account has not been activated"`)
- Network error dan system error ditampilkan sebagai fallback message
- Request yang sedang berjalan bisa dibatalkan via AbortController

## Styling dengan Prefix `mimin-`

Semua class Tailwind menggunakan prefix `mimin-` dengan format **prefix-first** — prefix
datang paling depan, sebelum variant maupun tanda negatif: `mimin:flex`, `mimin:text-sm`,
`mimin:hover:bg-white`, `mimin:-translate-y-1/2`. Urutan `hover:mimin:...` atau
`-mimin:...` TIDAK akan di-generate oleh Tailwind v4. Class yang di-apply secara
imperatif via `classList.add(...)` juga harus ditulis literal di source agar ter-generate
saat build.

## License

MIT License

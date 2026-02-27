
---

# 🤖 Run OpenClaw on Android — No PC, No Cloud, Better with eClaw Mobile UI

Turn your Android phone into a **24/7 AI agent** that runs entirely on-device. No computer required. No cloud server. Just your phone and an internet connection.

![download](https://github.com/user-attachments/assets/1c60502a-a329-412b-8ca2-88520853b75a)

## What You'll Get

By the end of this guide, your Android phone will:

- 🧠 Run **OpenClaw** locally
- ⚡ Act as a **24/7 AI agent**
- 🖥️ Be controllable from a **Mobile UI**
- 📴 Operate **without a PC or cloud server**

## Prerequisites

| Requirement | Details |
|---|---|
| 📱 Android phone | Android 10+ recommended |
| 🌐 Internet | Stable connection |
| 🔑 Gemini API key | Free from [Google AI Studio](https://aistudio.google.com) |
| 📦 Termux | From **F-Droid** (not Play Store) |

---

## 📲 Step 1 — Install Termux

### 1.1 Install F-Droid

1. Open your phone browser and go to **[f-droid.org](https://f-droid.org)**
2. Download and install the F-Droid APK
3. Allow **"Install unknown apps"** when prompted

### 1.2 Install Termux from F-Droid

1. Open F-Droid → Search **Termux** → Install

> [!NOTE]
> If you see **"⚠️ Unsafe app blocked"**, tap **More details → Install anyway**.

<details>
<summary>🛡️ Still blocked? Temporarily disable Play Protect</summary>

1. Open **Google Play Store**
2. Tap your **profile icon** → **Play Protect** → ⚙️ **Settings**
3. Turn off:
   - *Scan apps with Play Protect*
   - *Improve harmful app detection*
4. Install Termux, then re-enable Play Protect

</details>

---

## 🐧 Step 2 — Set Up Ubuntu via proot-distro

```bash
pkg update && pkg upgrade -y
apt update && apt all-upgrade
pkg install proot-distro
proot-distro install ubuntu
proot-distro login ubuntu
```

---

## ⚙️ Step 3 — Install Dependencies

Inside the Ubuntu shell:

```bash
apt update && apt upgrade -y
apt install -y curl git

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

---

## 🐾 Step 4 — Install OpenClaw & eClaw

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw --version
```

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

---

## 🩹 Step 5 — Fix Android Network Interface Error

Android's proot environment lacks proper network interfaces. Create a small shim /root/hijack.js:

```bash
const os = require('os');
os.networkInterfaces = () => ({});


echo 'export NODE_OPTIONS="-r /root/hijack.js"' >> ~/.bashrc
source ~/.bashrc
```

---

## 🚀 Step 6 — Launch OpenClaw

### Run the openclaw setup wizard

```bash
openclaw onboard &
```

> When prompted for **Gateway Bind**, select: `127.0.0.1 (Loopback)`

### Start the openclaw

```bash
openclaw gateway &
```

## 🚀 Step 7 — Launch eClaw Mobile UI

### Download eClaw

```bash
git clone https://github.com/wubox9/eclaw.git
```

### Start the eClaw

```bash
cd eclaw
node build.js
node server.js &
```

---

## 🎉 You're Live!

Your Android phone is now running OpenClaw as a self-contained AI agent. Access the web dashboard from the URL shown in your terminal.

---


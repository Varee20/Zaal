# Zaal

A futuristic desktop dashboard for Windows. Live system stats, tasks, a multi-system calendar, quick power controls and a local AI assistant, all in one dark, gold-accented app that can launch when your PC starts.

Built with Electron and plain HTML/CSS/JS. No frameworks, no cloud accounts.

## Features

**Dashboard**
- Live CPU, GPU, RAM, battery and temperature gauges
- Drive usage overview
- Network download/upload speed and Wi-Fi status
- Tools: weather, battery health, focus (Pomodoro) timer, quick note

**Tasks**
- Add tasks with a date, time and category
- Filter by category

**Calendar**
- Islamic, Persian and American (Gregorian) calendar systems
- Optional holiday overlays for each
- Per-day events with times

**AI center**
- Chat assistant that runs locally through [Ollama](https://ollama.com)
- Can add tasks, set events and organize your list, and asks before changing anything
- Nothing you write leaves your PC

**Everything else**
- Global search across tasks, events and pages (`Ctrl+K`)
- Quick actions: lock, sleep, restart, shut down, open Task Manager
- Pull-out "Today" panel with greeting, date, uptime, events and tasks
- Optional launch on Windows startup

## Getting started

Requirements: Windows 10/11 and [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone https://github.com/<your-username>/Zaal.git
cd Zaal
npm install
npm start
```

### Build the installer

```bash
npm run dist
```

The installer lands in `dist/`. On Windows you can also just run `build.bat`, which re-launches itself as admin (needed once for the icon tooling) and uses npm mirrors for networks where GitHub downloads fail.

### AI assistant setup

Open the **AI center** tab and click **Set up the assistant**. Zaal will install and link Ollama for you. Small local models can make mistakes, which is why every change needs your confirmation.

## Project structure

```
Zaal/
├── main.js          # Electron main process
├── preload.js       # Secure bridge between main and renderer
├── ollama.js        # Local AI (Ollama) integration
├── index.html       # App shell
├── css/style.css    # Theme and layout
├── js/              # Renderer modules (dashboard, tasks, calendar, AI, ...)
├── Zaal.ico         # App icon
└── build.bat        # One-click Windows installer build
```

## Tech stack

- [Electron](https://www.electronjs.org)
- [systeminformation](https://systeminformation.io) for hardware stats
- [electron-builder](https://www.electron.build) for the NSIS installer
- [Ollama](https://ollama.com) for the local AI

## Notes

- Islamic and Persian dates are calculated, so they can be off by a day.

## Roadmap

- [ ] Fan control
- [ ] Email integration
- [ ] Screenshots and demo GIF

## License

No license chosen yet. Add a `LICENSE` file before sharing widely.

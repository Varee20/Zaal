# Zaal

**Your PC's dashboard.** Live hardware stats, tasks, a multi-system calendar and a local AI assistant, in one app that runs on your machine and nowhere else.

Built with Electron and plain HTML/CSS/JS.

> **Platform support:** Windows and Linux (Ubuntu, Debian, Mint, Fedora, Arch and most others).

<p align="center">
  <img src="Screen%20shots/dashboard.png" alt="Zaal dashboard with live CPU, GPU, RAM, battery and temperature gauges" width="49%">
  <img src="Screen%20shots/calendar-page.png" alt="Zaal calendar with per-day events and task deadlines" width="49%">
</p>

## Features

**Dashboard**
- Live CPU, GPU, RAM, battery and temperature gauges
- Drive usage overview
- Network download/upload speed and Wi-Fi status
- Tools: weather, battery health, focus (Pomodoro) timer, quick note

**Tasks**
- Add tasks with a deadline (date and time), a category, a priority (Low, Medium, High) and subtasks
- Edit tasks, filter by category, and see deadlines on the calendar

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
- Quick actions: lock, sleep, restart, shut down, open the system monitor
- Pull-out "Today" panel with greeting, date, uptime, events and tasks
- Optional launch at startup
- Customize: 10 themes (Bronze, Silver, Gold, Titanium, Copper, Rose Gold, Cobalt, Verdigris, Platinum, Obsidian), a Custom theme where you pick any color, and Dark, Light or Match system mode (Settings > Customize)

## What's new

### v0.3.0
- **No more system-looking controls.** The hour/minute boxes, the dropdown lists (Year, Month, Day, AM/PM, AI model) and the category suggestions are now Zaal's own and follow your theme, in dark and light.
  - Hour and minute boxes have themed up/down buttons, and also work with the arrow keys and mouse wheel. Minutes show as `05`, and 12 wraps back to 1.
  - Dropdowns open a themed list you can use with the keyboard (arrows, Enter, Esc) or by typing to jump (`14` jumps to 1404).
- **A full visual polish of the whole app:**
  - New sidebar with a logo, icons, a glowing active marker, and the version number at the bottom.
  - Redesigned top bar: search with a `Ctrl K` hint, grouped quick-action buttons, and the date under the clock.
  - Every page has a proper title. Cards, tiles and panels have soft lighting, depth and a faint grid behind them.
  - Gauges have a glow and a dashed outer ring, and cards lift when you hover them.
  - Redesigned task cards with a priority bar, a round priority control and themed checkboxes. The calendar has bigger, softer day cells.
  - Settings use switches and segmented buttons. The AI chat, the Today panel and the popup got the same treatment.
  - Pages fade in and the popups animate. Everything respects "reduce motion".
- The focus timer has a progress bar.
- The window now has a minimum size so the layout never breaks.

### v0.2.1
- **7 new themes:** Titanium, Copper, Rose Gold, Cobalt, Verdigris, Platinum and Obsidian. With Bronze, Silver and Gold that makes 10.
- **Custom theme:** pick any color you like. Zaal works out the rest of the colors from it and adjusts it a little so text stays readable in dark and light mode.
- **Match system mode:** next to Dark and Light, follows your PC's dark/light setting and switches with it.
- **Bronze looks different now:** it's a muted brown-gold so it no longer looks like the new red-orange Copper.
- Themes are now defined in one table in `js/theme.js`, so adding a new one takes a single line.

### v0.2.0
- **Themes:** new Customize section in Settings with Bronze, Silver and Gold themes.
- **Dark and Light mode:** switch the whole app between them.
- The window opens in the right color, so there's no dark flash if you use light mode.

## Getting started (Windows)

Requirements: Windows 10/11 and [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone https://github.com/Varee20/Zaal.git
cd Zaal
npm install
npm start
```

### Build the installer

```bash
npm run dist
```

The installer lands in `dist/`. On Windows you can also just run `build.bat`, which re-launches itself as admin (needed once for the icon tooling) and uses npm mirrors for networks where GitHub downloads fail.

Or go to the [Releases page](https://github.com/Varee20/Zaal/releases), open the latest release and download the `.exe` installer. Run it and Zaal installs and opens.

### AI assistant setup

Open the **AI center** tab and click **Set up the assistant**. Zaal will install and link Ollama for you. Small local models can make mistakes, which is why every change needs your confirmation.

## Linux

Zaal runs on Linux too. Pick the section that fits you.

### A. Install it (for normal users)

Go to the [Releases page](https://github.com/Varee20/Zaal/releases) and download one file:

**Ubuntu, Debian, Linux Mint, Pop!_OS** (the `.deb` file):

```bash
sudo apt install ./zaal_0.3.0_amd64.deb
```

(Use the real file name you downloaded, and run the command in the folder where it is.) Then open **Zaal** from your app menu.

**Any other distro, including Fedora and Arch** (the `.AppImage` file):

```bash
chmod +x Zaal-0.3.0.AppImage
./Zaal-0.3.0.AppImage
```

The first line makes the file runnable, the second starts it. You can also right-click the file, open Properties, and tick "Allow executing as program".

**Only for the AI center:** Zaal needs the `zstd` tool to unpack Ollama. Install it once:

```bash
sudo apt install zstd        # Ubuntu, Debian, Mint
sudo dnf install zstd        # Fedora
sudo pacman -S zstd          # Arch
```

If the app doesn't start, run it from a terminal (`./Zaal-0.3.0.AppImage` or `zaal`) and the error message will show up there.

### B. Run it from source (for developers)

You need [Node.js](https://nodejs.org) 18 or newer and git.

```bash
git clone https://github.com/Varee20/Zaal.git
cd Zaal
npm install
npm start
```

### C. Build the Linux installers (for the maintainer)

**The easy way (automatic):** GitHub builds everything for you. After pushing your code, run:

```bash
git tag v0.3.0
git push origin v0.3.0
```

Wait about 10 minutes (watch it on the repo's **Actions** tab). A release named `v0.3.0` then appears on the **Releases** page with the Windows installer, the `.deb` and the `.AppImage`. For the next version, change `version` in `package.json`, push, and use a new tag such as `v0.3.1`. The recipe lives in `.github/workflows/release.yml`.

**The manual way:** The Linux files have to be built **on Linux**. A Windows PC can't build them. Use a Linux PC, a virtual machine, or WSL.

1. Push all your latest changes to GitHub from Windows.
2. On the Linux machine, get a fresh copy. Do not copy `node_modules` over from Windows:
   ```bash
   git clone https://github.com/Varee20/Zaal.git
   cd Zaal
   npm install
   ```
3. Build:
   ```bash
   npm run dist:linux
   ```
4. Your files are now in the `dist/` folder: a `.AppImage` and a `.deb`.
5. Upload both to GitHub: open the repo, click **Releases**, then **Draft a new release**, drag in the two files and publish. Users download them from there (section A).

The app icon is made automatically from `Zaal.ico` into `build/icon.png`. To use your own, put a 512x512 PNG at `build/icon.png` first.

Before publishing the `.deb`, open `package.json` and change the `maintainer` line under `build` > `linux` from `noreply@example.com` to your real email.

### What works differently on Linux

- **GPU gauge:** works for NVIDIA and AMD. Intel graphics show `--`.
- **Launch at startup:** adds a small file in `~/.config/autostart`. Turning it off deletes it.
- **Lock, sleep, restart, shut down:** use `loginctl` and `systemctl`, which most distros have. The last button opens whichever system monitor your desktop has (GNOME, KDE, MATE, XFCE).
- **AI center:** Ollama is installed into your home folder (`~/.local/share/zaal/ollama`), so no `sudo` is needed. If you already have Ollama installed, Zaal uses that instead. AMD graphics cards run the AI on the CPU for now.
- **AppImage on Ubuntu 24.04 and newer:** it runs with Chromium's sandbox turned off, because Ubuntu blocks it for AppImages. The `.deb` doesn't have this problem, so prefer it on Ubuntu.
- **Wi-Fi speed:** may be blank on some setups.

## Project structure

```
Zaal/
├── main.js          # Electron main process
├── preload.js       # Secure bridge between main and renderer
├── ollama.js        # Local AI (Ollama) integration
├── index.html       # App shell
├── css/style.css    # Theme and layout
├── js/              # Renderer modules (dashboard, tasks, calendar, AI, theme, ui controls, ...)
├── Zaal.ico         # App icon
├── scripts/         # make-icon.js (builds the Linux PNG icon)
└── build.bat        # One-click Windows installer build
```

## Tech stack

- [Electron](https://www.electronjs.org)
- [systeminformation](https://systeminformation.io) for hardware stats
- [electron-builder](https://www.electron.build) for the NSIS installer
- [Ollama](https://ollama.com) for the local AI

## Notes

- Islamic and Persian dates are calculated, so they can be off by a day.

## License

[MIT](LICENSE)

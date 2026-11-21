# Zaal Lite

**The light version of Zaal, made for older and weaker PCs.** Live hardware stats, tasks and a multi-system calendar in one small app that stays out of your way.

Zaal Lite keeps the parts you use every day and drops the heavy ones, so it runs smoothly on low-spec laptops where the full version feels slow.

Built with Electron and plain HTML/CSS/JS. No frameworks, no cloud accounts.

> **Looking for the full version?** It has the GPU gauge and the local AI assistant. Find it on the [`main` branch](https://github.com/Varee20/Zaal/tree/main).

> **Platform support:** Windows and Linux (Ubuntu, Debian, Mint, Fedora, Arch and most others).

## What makes it lighter

- **Nothing is read while you can't see it.** Stats stop updating when the window is minimized or you are on another page, and refresh the moment you come back.
- **CPU and RAM come straight from Node.** No extra process, so they cost almost nothing.
- **Slow readings are cached.** Battery, drives, Wi-Fi and temperature are read every 20 to 60 seconds instead of constantly.
- **No PowerShell polling.** That was the biggest CPU eater in the full version. Network speed on Windows uses the tiny built-in `netstat` program instead.
- **No GPU polling and no AI center.** The local AI model is far too heavy for weak PCs, so Lite leaves it out.

## Features

**Dashboard**
- Live CPU, RAM, battery and temperature gauges
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

**Everything else**
- Global search across tasks, events and pages (`Ctrl+K`)
- Quick actions: lock, sleep, restart, shut down, open the system monitor
- Pull-out "Today" panel with greeting, date, uptime, events and tasks
- Optional launch at startup

## Lite vs. full Zaal

| | Zaal Lite | Zaal |
|---|---|---|
| CPU, RAM, battery, temperature, drives, internet | Yes | Yes |
| GPU gauge | No | Yes |
| Tasks, calendar, search, Today panel, weather, focus timer | Yes | Yes |
| Local AI assistant (Ollama) | No | Yes |
| Built for weak PCs | Yes | No |

## Install (Windows)

Go to the [Releases page](https://github.com/Varee20/Zaal/releases), open the latest **Zaal Lite** release and download the `.exe` file. Run it and Zaal Lite installs and opens.

### Run it from source

Requirements: Windows 10/11 and [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone https://github.com/Varee20/Zaal.git
cd Zaal
git checkout lite
npm install
npm start
```

### Build the installer yourself

```bash
npm run dist
```

The installer lands in `dist/`. On Windows you can also run `build.bat`, which re-launches itself as admin (needed once for the icon tooling) and uses npm mirrors for networks where GitHub downloads fail.

## Install (Linux)

Go to the [Releases page](https://github.com/Varee20/Zaal/releases), open the latest **Zaal Lite** release and download one file:

**Ubuntu, Debian, Linux Mint, Pop!_OS** (the `.deb` file):

```bash
sudo apt install ./the-file-you-downloaded.deb
```

Run the command in the folder where the file is, then open **Zaal Lite** from your app menu.

**Any other distro, including Fedora and Arch** (the `.AppImage` file):

```bash
chmod +x the-file-you-downloaded.AppImage
./the-file-you-downloaded.AppImage
```

The first line makes the file runnable, the second starts it. You can also right-click the file, open Properties, and tick "Allow executing as program".

If the app doesn't start, run it from a terminal and the error message will show up there.

### What works differently on Linux

- **Launch at startup:** adds a small file in `~/.config/autostart`. Turning it off deletes it.
- **Lock, sleep, restart, shut down:** use `loginctl` and `systemctl`, which most distros have. The last button opens whichever system monitor your desktop has (GNOME, KDE, MATE, XFCE).
- **AppImage on Ubuntu 24.04 and newer:** it runs with Chromium's sandbox turned off, because Ubuntu blocks it for AppImages. The `.deb` doesn't have this problem, so prefer it on Ubuntu.
- **Temperature and Wi-Fi speed:** may show `N/A` on some laptops and setups.

## For the maintainer: publishing a release

GitHub builds the Windows installer, the `.deb` and the `.AppImage` for you. Push a tag that starts with `v`:

```bash
git tag v0.1.0-lite.1
git push origin v0.1.0-lite.1
```

Wait about 10 minutes (watch the repo's **Actions** tab). A prerelease named **Zaal Lite v0.1.0-lite.1** then appears on the **Releases** page. For the next version, change `version` in `package.json` and use a new tag such as `v0.1.0-lite.2`. The recipe lives in `.github/workflows/release.yml`.

Before publishing the `.deb`, open `package.json` and change the `maintainer` line under `build` > `linux` from `noreply@example.com` to your real email.

## Project structure

```
Zaal/
├── main.js          # Electron main process (cached, low-cost stats)
├── preload.js       # Secure bridge between main and renderer
├── index.html       # App shell
├── css/style.css    # Theme and layout
├── js/              # Renderer modules (dashboard, tasks, calendar, ...)
├── Zaal.ico         # App icon
├── scripts/         # make-icon.js (builds the Linux PNG icon)
└── build.bat        # One-click Windows installer build
```

## Tech stack

- [Electron](https://www.electronjs.org)
- [systeminformation](https://systeminformation.io) for hardware stats
- [electron-builder](https://www.electron.build) for the installers

## Notes

- Islamic and Persian dates are calculated, so they can be off by a day.

## License

[MIT](LICENSE)

# Zaal Mini

Zaal for your Android phone: a futuristic little command center for your day.
Tasks, calendar, a one-tap focus mode with real Do Not Disturb, smart widgets on your dashboard **and your home screen**, reminders, phone-wide screen time and 8 languages, in the same look as Zaal v0.3.0.

> Status: **v0.1.0 (first build)**. The app is built into an installable `.apk` by GitHub (see "Get the APK"). The native Android parts were written without being able to run them, so expect a fix or two after the first test on a real phone.

---

## What's new in v0.1.0

- **Zaal Mini is born.** A phone version of Zaal, on its own branch (`Zaal-mini`) with its own app name and its own saved data. Everything that only makes sense on a PC is gone: the AI center, the lock / sleep / restart buttons, CPU / GPU / temperature, fans and drives.
- **Pull-out menu drawer.** Tap the menu button, tap or drag the little tab on the screen edge, or swipe it out. It follows your finger. In Persian and Arabic it comes from the right.
- **Focus tab (new).** One tap on **Start focus** starts a work session (pomodoro: 25 min focus, 5 min break, both adjustable) and turns on **focus mode**. Reminders that are not critical are held until the session ends, and **High-priority tasks still get through**. On the phone it also switches on Android's **Do Not Disturb** (priority only) for the session and switches it back off when the session ends, even if the app was closed. The timer survives closing the app. Sessions, focused minutes and your streak are counted.
- **Smart widgets, in the app and on your home screen.**
  - *In the app* (dashboard): **Today's schedule**, **Next tasks** (the next 3), **Today's progress** (rings: tasks, focus sessions, active days this week) and **Streak**, each in S / M / L. Turn them on or off and pick sizes in Settings.
  - *On the Android home screen:* three real widgets. **Small (2x2)**: streak + next task. **Medium (4x2)**: next three tasks. **Large (4x4)**: schedule, next tasks, progress rings and streak. They update whenever your data changes. Tap one to open the app.
- **Swipe actions everywhere.** On tasks, calendar events and the widgets: swipe toward the end of the row to **finish** a task (or reopen it); swipe the other way to open **Snooze (+1 hour)**, **Tomorrow (reschedule)** and **Priority (cycles Low / Medium / High)**. Your own events get Snooze, Tomorrow and Delete.
- **Reminders (notifications).** Tasks with a deadline and events with a time get a reminder N minutes before (you choose, or only at the time) and again when they are due. Optional **morning summary** at 8:00. A "focus session is over" notification. High-priority tasks use a separate "Critical reminders" channel that asks to get through Do Not Disturb. A "Send a test notification" button in Settings.
- **Screen time tab (new).** Today's total, the last 7 days as bars, the daily average and where the time went. Two sources: **Zaal Mini** (time inside this app) and, once you allow Usage access, **All apps** (phone-wide, with your most used apps today).
- **Language chooser.** English (default), **Persian (فارسی)**, Arabic (العربية), Turkish, Russian, Spanish, French and German. Persian and Arabic switch the whole layout to right-to-left, and months and weekdays follow the language (Persian and Islamic month names in Persian / Arabic script).
- **Phone layout.** One column, phone-sized cards and pickers, safe areas for the status bar.

---

## Get the APK

GitHub builds the app for you in the cloud. **You don't need Android Studio, Java or Android tools on your PC.**

1. Push the `Zaal-mini` branch to GitHub (`git push origin Zaal-mini`). Every push builds an `.apk`: open the repository's **Actions** tab, click the latest "Android APK" run and download **Zaal-Mini-apk** at the bottom of the page.
2. To publish a proper release, tag it:
   ```
   git tag mini-v0.1.0
   git push origin mini-v0.1.0
   ```
   The `.apk` then appears under **Releases**. (Tags must start with `mini-v`. The desktop release workflow only reacts to tags that start with `v`.)
3. Put the `.apk` on your phone and open it. Android asks you to allow installing from this source once.

If a build fails, open the failed run, copy the red error and send it over.

### What the app asks permission for

| Permission | Why | When you are asked |
|---|---|---|
| Notifications | reminders, "focus session is over" | the first time the app opens |
| Do Not Disturb access | focus mode silences the phone | when you tap **Allow** on the Focus tab |
| Usage access | phone-wide screen time | when you tap **Allow usage access** on the Screen time tab |
| Exact alarms | reminders arrive on the minute | automatic |

Everything works without the two special permissions; you just don't get Do Not Disturb or all-apps screen time.

If **High-priority** reminders are still silenced during focus on your phone, open Android Settings > Apps > Zaal Mini > Notifications > **Critical reminders** and turn on **Override Do Not Disturb**. Some Android versions and phone makers need that switch.

### Home screen widgets

Long-press an empty spot on your home screen > **Widgets** > **Zaal Mini** and pick a size. They fill in the first time the app has opened and synced.

---

## Features

| | |
|---|---|
| Dashboard | Greeting, today's date and holidays, smart widgets, phone stats (battery, storage, network), weather, quick note |
| Tasks | Deadline (date + time), priority, category, subtasks, edit, swipe actions |
| Calendar | American, Persian or Islamic months, holidays, events, task deadlines |
| Focus | One-tap focus mode + pomodoro, silences non-critical reminders and the phone |
| Screen time | Time inside Zaal Mini, or phone-wide |
| Settings | Theme and your own color, dark / light / system, language, calendar, widgets, notifications |

---

## Try it on the PC

```
npm start
```

This opens Zaal Mini in a **phone-sized window**. It is only a preview shell (`main.js`): the real phone app is made from the same `index.html`, `css` and `js` folders. Data is saved inside the app (browser storage), separate from desktop Zaal. You can also open `index.html` in Chrome and press F12, then Ctrl+Shift+M for phone emulation.

| | PC preview | Phone app |
|---|---|---|
| Battery, storage | what the browser can see | the real phone values |
| Reminders | browser notifications, only while the app is open | real notifications, even when the app is closed |
| Do Not Disturb, all-apps screen time, home screen widgets | not available (hidden) | yes |
| Everything else | same | same |

---

## Honest notes

- **Translations** were written by an AI and may have awkward spots. Weather descriptions are grouped (clear, cloudy, rain, ...). Holiday names stay in English. Numbers stay 0-9 in every language.
- **The installed APK is a debug build.** It is signed with a throwaway debug key, which is fine for installing on your own phone. A proper signed release (needed for the Play Store) comes later.
- **Email tab and Notes tab** are not in v0.1.0 yet (the Quick note is still on the dashboard).
- The app icon is drawn from the Zaal logo on Android 8 and newer; older Androids show the default icon.

---

## Roadmap

1. Fix whatever the first real-phone test shows.
2. Notes tab and Email tab.
3. A proper signed release build.

---

## Project structure

```
index.html            the screens
main.js               PC preview window only (npm start)
capacitor.config.json the phone app's id and name
css/style.css         all the styling (dark / light, phone layout, right-to-left)
js/                   the app itself
  platform.js         saved data + weather (replaces the old Electron bridge)
  langs.js, langs-native.js   every text in every language
  i18n.js             the language engine (t('key'), right-to-left, data-i18n)
  theme.js            themes and your own color
  core.js             shared helpers, saved data, daily activity and streak
  ui.js               Zaal's own dropdowns, number boxes, suggestions and icons
  swipe.js            swipe actions + the little confirmation message
  dashboard.js        battery, storage, network
  tasks.js, calendar.js, calsys.js, holidays.js, datepicker.js
  search.js           the search bar
  notify.js           reminders
  native.js           the phone-only parts: Do Not Disturb, phone-wide usage, home screen widget data
  focus.js            the Focus tab
  widgets.js          the dashboard widgets
  today.js            greeting and holidays at the top of the dashboard
  screentime.js       the Screen time tab
  settings.js         the Settings page
  navdrawer.js        the pull-out menu
  weather.js, notes.js
  app.js              starts everything
native/                Android code added on top of the generated project
  java/               ZaalNativePlugin (Do Not Disturb, usage stats, channels, widget data), DndReceiver, the three widgets
  res/                widget layouts and settings, icons
scripts/
  build-web.js        copies the web files into www/ for Capacitor
  patch-android.js    adds native/ to the generated Android project
.github/workflows/android.yml   builds the APK in the cloud
```

### Adding a language

1. In `js/langs.js`, copy the `STR.en` block, rename it (for example `STR.it`) and translate the right-hand side. Do the same in `js/langs-native.js`. Keep the `{name}` parts as they are. Missing keys fall back to English.
2. In `js/i18n.js`, add one line to `LANGS` (its name, `ltr` or `rtl`, and its locale code).

---

## License

MIT

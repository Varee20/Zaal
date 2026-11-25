package com.varee20.zaalmini;

import android.app.AlarmManager;
import android.app.AppOpsManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Zaal Mini's own native bridge. The web app talks to it as Capacitor.Plugins.ZaalNative.
 *   Do Not Disturb      : dndStatus, dndRequestAccess, dndStart, dndStop
 *   Notification channels: createChannels
 *   Phone-wide screen time: usageStatus, usageRequestAccess, usageGet
 *   Home screen widgets : setWidgetData
 */
@CapacitorPlugin(name = "ZaalNative")
public class ZaalNativePlugin extends Plugin {

    static final String PREFS = "zaal_native";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private NotificationManager nm() {
        return (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
    }

    // ------------------------------------------------------------------
    // Notification channels
    // "Critical" and "Focus" channels ask to get through Do Not Disturb, so High-priority tasks and the
    // "focus session is over" message are not silenced by the focus mode that Zaal itself turns on.
    // ------------------------------------------------------------------
    @PluginMethod
    public void createChannels(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = nm();
            makeChannel(nm, "zaal-tasks", "Task reminders", "Reminders for tasks and events", false);
            makeChannel(nm, "zaal-critical", "Critical reminders", "High-priority tasks. They get through Do Not Disturb.", true);
            makeChannel(nm, "zaal-focus", "Focus timer", "When a focus session or break ends", true);
        }
        call.resolve();
    }

    private void makeChannel(NotificationManager nm, String id, String name, String description, boolean bypassDnd) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel c = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
        c.setDescription(description);
        c.enableVibration(true);
        if (bypassDnd) c.setBypassDnd(true);
        nm.createNotificationChannel(c); // does nothing if the channel already exists
    }

    // ------------------------------------------------------------------
    // Do Not Disturb
    // ------------------------------------------------------------------
    @PluginMethod
    public void dndStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", nm().isNotificationPolicyAccessGranted());
        r.put("active", prefs().getInt("dnd_prev", -1) != -1); // we switched it on and have not switched it off yet
        call.resolve(r);
    }

    @PluginMethod
    public void dndRequestAccess(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    // Switches on "priority only" Do Not Disturb until the given time (ms since 1970). An alarm switches it off again
    // even if the app is closed or killed in the meantime.
    @PluginMethod
    public void dndStart(PluginCall call) {
        NotificationManager nm = nm();
        if (!nm.isNotificationPolicyAccessGranted()) {
            call.reject("no access");
            return;
        }
        long end = call.getData().optLong("end", 0L);
        SharedPreferences p = prefs();
        if (p.getInt("dnd_prev", -1) == -1) {
            int prev = nm.getCurrentInterruptionFilter();
            if (prev != NotificationManager.INTERRUPTION_FILTER_ALL) {
                // the phone is already in some Do Not Disturb mode of the user's own: leave it alone
                call.resolve();
                return;
            }
            p.edit().putInt("dnd_prev", prev).apply();
        }
        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
        scheduleEnd(getContext(), end);
        call.resolve();
    }

    @PluginMethod
    public void dndStop(PluginCall call) {
        DndReceiver.restore(getContext());
        call.resolve();
    }

    static PendingIntent endIntent(Context c) {
        Intent i = new Intent(c, DndReceiver.class);
        i.setAction("com.varee20.zaalmini.DND_END");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(c, 7711, i, flags);
    }

    private static void scheduleEnd(Context c, long end) {
        if (end <= System.currentTimeMillis()) return;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = endIntent(c);
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, pi); // a few minutes late at worst
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, pi);
        }
    }

    // ------------------------------------------------------------------
    // Phone-wide screen time (needs "Usage access", which the user grants in Android settings)
    // ------------------------------------------------------------------
    private boolean hasUsageAccess() {
        AppOpsManager ops = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        String pkg = getContext().getPackageName();
        int mode = Build.VERSION.SDK_INT >= 29
                ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), pkg)
                : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), pkg);
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    @PluginMethod
    public void usageStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", hasUsageAccess());
        call.resolve(r);
    }

    @PluginMethod
    public void usageRequestAccess(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    // Returns { days: [{ date: "2026-11-24", sec: 1234 }, ...oldest first], apps: [{ name, sec }, ...today's most used] }
    @PluginMethod
    public void usageGet(PluginCall call) {
        if (!hasUsageAccess()) {
            call.reject("no access");
            return;
        }
        int days = Math.max(1, Math.min(30, call.getData().optInt("days", 7)));
        Context ctx = getContext();
        UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        PackageManager pm = ctx.getPackageManager();

        // the home screen (launcher) is not "screen time"
        String launcher = "";
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        ResolveInfo ri = pm.resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
        if (ri != null && ri.activityInfo != null) launcher = ri.activityInfo.packageName;

        Calendar midnight = Calendar.getInstance();
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 0);
        midnight.set(Calendar.MILLISECOND, 0);

        JSArray perDay = new JSArray();
        Map<String, Long> todayApps = new HashMap<>();

        for (int back = days - 1; back >= 0; back--) {
            Calendar from = (Calendar) midnight.clone();
            from.add(Calendar.DAY_OF_YEAR, -back);
            Calendar to = (Calendar) from.clone();
            to.add(Calendar.DAY_OF_YEAR, 1);
            long end = Math.min(to.getTimeInMillis(), System.currentTimeMillis());

            long total = 0;
            Map<String, UsageStats> stats = usm.queryAndAggregateUsageStats(from.getTimeInMillis(), end);
            for (Map.Entry<String, UsageStats> e : stats.entrySet()) {
                String pkg = e.getKey();
                if (pkg.equals(launcher) || pm.getLaunchIntentForPackage(pkg) == null) continue; // only real apps
                long ms = e.getValue().getTotalTimeInForeground();
                if (ms <= 0) continue;
                total += ms;
                if (back == 0 && ms >= 60000) todayApps.put(pkg, ms);
            }

            JSObject o = new JSObject();
            o.put("date", String.format(Locale.US, "%04d-%02d-%02d", from.get(Calendar.YEAR), from.get(Calendar.MONTH) + 1, from.get(Calendar.DAY_OF_MONTH)));
            o.put("sec", total / 1000);
            perDay.put(o);
        }

        List<Map.Entry<String, Long>> sorted = new ArrayList<>(todayApps.entrySet());
        Collections.sort(sorted, (a, b) -> Long.compare(b.getValue(), a.getValue()));
        JSArray apps = new JSArray();
        for (int i = 0; i < Math.min(8, sorted.size()); i++) {
            String pkg = sorted.get(i).getKey();
            String name = pkg;
            try {
                name = pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
            } catch (Exception ignored) { /* keep the package name */ }
            JSObject o = new JSObject();
            o.put("name", name);
            o.put("sec", sorted.get(i).getValue() / 1000);
            apps.put(o);
        }

        JSObject r = new JSObject();
        r.put("days", perDay);
        r.put("apps", apps);
        call.resolve(r);
    }

    // ------------------------------------------------------------------
    // Home screen widgets: the web app sends a small snapshot (JSON text); the widgets draw from it
    // ------------------------------------------------------------------
    @PluginMethod
    public void setWidgetData(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("no data");
            return;
        }
        prefs().edit().putString("widget", json).apply();
        ZaalWidgetBase.updateAll(getContext());
        call.resolve();
    }
}

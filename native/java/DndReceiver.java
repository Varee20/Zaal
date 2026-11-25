package com.varee20.zaalmini;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * Switches Do Not Disturb back to what it was before the focus session. Runs from an alarm, so it works
 * even when Zaal Mini was closed in the meantime. Also used by the app itself when you end a session early.
 */
public class DndReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        restore(context);
    }

    static void restore(Context c) {
        SharedPreferences p = c.getSharedPreferences(ZaalNativePlugin.PREFS, Context.MODE_PRIVATE);
        int prev = p.getInt("dnd_prev", -1);

        // the alarm is no longer needed
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            am.cancel(ZaalNativePlugin.endIntent(c));
        } catch (Exception ignored) { /* nothing to cancel */ }

        if (prev == -1) return; // we never switched it on
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.isNotificationPolicyAccessGranted()) nm.setInterruptionFilter(prev);
        p.edit().remove("dnd_prev").apply();
    }
}

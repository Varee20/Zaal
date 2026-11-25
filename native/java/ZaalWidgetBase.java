package com.varee20.zaalmini;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Base of the three home screen widgets (small, medium, large). The web app sends a snapshot of the day
 * (events, next tasks, progress rings, streak) as JSON through ZaalNativePlugin.setWidgetData; the widgets draw from it.
 */
public abstract class ZaalWidgetBase extends AppWidgetProvider {

    protected abstract int layoutId();

    protected abstract void fill(Context c, RemoteViews rv, JSONObject d, int accent);

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, build(ctx));
    }

    RemoteViews build(Context ctx) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), layoutId());
        JSONObject d = load(ctx);
        int accent = color(d.optString("accent", "#D4AF37"), 0xFFD4AF37);

        // tapping the widget opens the app
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) {
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            rv.setOnClickPendingIntent(R.id.zw_root, PendingIntent.getActivity(ctx, 0, open, flags));
        }
        fill(ctx, rv, d, accent);
        return rv;
    }

    // ---------- Updating every widget that is on the home screen ----------
    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        refresh(ctx, mgr, new ComponentName(ctx, ZaalWidgetSmall.class), new ZaalWidgetSmall());
        refresh(ctx, mgr, new ComponentName(ctx, ZaalWidgetMedium.class), new ZaalWidgetMedium());
        refresh(ctx, mgr, new ComponentName(ctx, ZaalWidgetLarge.class), new ZaalWidgetLarge());
    }

    private static void refresh(Context ctx, AppWidgetManager mgr, ComponentName cn, ZaalWidgetBase provider) {
        int[] ids = mgr.getAppWidgetIds(cn);
        if (ids == null || ids.length == 0) return;
        mgr.updateAppWidget(ids, provider.build(ctx));
    }

    // ---------- Helpers ----------
    static JSONObject load(Context c) {
        try {
            String s = c.getSharedPreferences(ZaalNativePlugin.PREFS, Context.MODE_PRIVATE).getString("widget", "{}");
            return new JSONObject(s);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static int color(String hex, int fallback) {
        try {
            return Color.parseColor(hex);
        } catch (Exception e) {
            return fallback;
        }
    }

    // Fills up to ids.length text rows from a JSON list. Row 0 shows "empty" when the list is empty; unused rows are hidden.
    static void rows(RemoteViews rv, int[] ids, JSONArray list, boolean tasks, String empty) {
        int n = list == null ? 0 : list.length();
        for (int i = 0; i < ids.length; i++) {
            if (i < n) {
                JSONObject o = list.optJSONObject(i);
                String line;
                if (tasks) {
                    String due = o.optString("due", "");
                    line = (o.optInt("p", 1) >= 2 ? "! " : "\u2022 ") + o.optString("t", "") + (due.isEmpty() ? "" : "   " + due);
                } else {
                    String time = o.optString("time", "");
                    line = (time.isEmpty() ? "" : time + "   ") + o.optString("t", "");
                }
                rv.setTextViewText(ids[i], line);
                rv.setViewVisibility(ids[i], View.VISIBLE);
            } else if (i == 0) {
                rv.setTextViewText(ids[i], empty);
                rv.setViewVisibility(ids[i], View.VISIBLE);
            } else {
                rv.setViewVisibility(ids[i], View.GONE);
            }
        }
    }

    // The three progress rings, drawn into a picture
    static Bitmap ringsBitmap(JSONArray rings, int accent) {
        final int w = 720, h = 220;
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);

        Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
        track.setStyle(Paint.Style.STROKE);
        track.setStrokeWidth(16);
        track.setColor(0xFF2B2B2E);
        Paint bar = new Paint(Paint.ANTI_ALIAS_FLAG);
        bar.setStyle(Paint.Style.STROKE);
        bar.setStrokeWidth(16);
        bar.setStrokeCap(Paint.Cap.ROUND);
        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setColor(0xFFF4F1EA);
        text.setTextAlign(Paint.Align.CENTER);
        text.setTextSize(34);
        Paint label = new Paint(Paint.ANTI_ALIAS_FLAG);
        label.setColor(0xFF8D8A82);
        label.setTextAlign(Paint.Align.CENTER);
        label.setTextSize(25);

        int[] colors = {accent, 0xFFA8A59D, 0xFFE3D3A1};
        int n = rings == null ? 0 : Math.min(3, rings.length());
        int cell = w / 3;
        for (int i = 0; i < n; i++) {
            JSONObject r = rings.optJSONObject(i);
            float cx = cell * i + cell / 2f;
            float cy = 88f;
            float rad = 64f;
            RectF box = new RectF(cx - rad, cy - rad, cx + rad, cy + rad);
            double pct = Math.max(0, Math.min(100, r.optDouble("pct", 0)));
            cv.drawArc(box, 0, 360, false, track);
            bar.setColor(colors[i]);
            if (pct > 0) cv.drawArc(box, -90, (float) (360 * pct / 100), false, bar);
            cv.drawText(r.optString("text", ""), cx, cy + 12, text);
            cv.drawText(r.optString("label", ""), cx, 200, label);
        }
        return bmp;
    }
}

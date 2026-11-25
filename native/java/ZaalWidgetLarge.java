package com.varee20.zaalmini;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Large widget (4x4): today's schedule, the next tasks, the progress rings and the streak. */
public class ZaalWidgetLarge extends ZaalWidgetBase {

    @Override
    protected int layoutId() {
        return R.layout.zw_large;
    }

    @Override
    protected void fill(Context c, RemoteViews rv, JSONObject d, int accent) {
        rv.setTextViewText(R.id.zw_h1, d.optString("hSchedule", ""));
        rv.setTextColor(R.id.zw_h1, accent);
        rows(rv, new int[]{R.id.zw_e1, R.id.zw_e2, R.id.zw_e3, R.id.zw_e4}, d.optJSONArray("events"), false, d.optString("emptyE", ""));

        rv.setTextViewText(R.id.zw_h2, d.optString("hNext", ""));
        rv.setTextColor(R.id.zw_h2, accent);
        rows(rv, new int[]{R.id.zw_t1, R.id.zw_t2, R.id.zw_t3}, d.optJSONArray("tasks"), true, d.optString("emptyT", ""));

        rv.setImageViewBitmap(R.id.zw_rings, ringsBitmap(d.optJSONArray("rings"), accent));
        rv.setViewVisibility(R.id.zw_rings, View.VISIBLE);

        rv.setTextViewText(R.id.zw_streak, "\uD83D\uDD25 " + d.optInt("streak", 0) + "  " + d.optString("streakLabel", ""));
        rv.setTextColor(R.id.zw_streak, accent);
    }
}

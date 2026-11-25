package com.varee20.zaalmini;

import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Small widget (2x2): the streak and the next task. */
public class ZaalWidgetSmall extends ZaalWidgetBase {

    @Override
    protected int layoutId() {
        return R.layout.zw_small;
    }

    @Override
    protected void fill(Context c, RemoteViews rv, JSONObject d, int accent) {
        rv.setTextViewText(R.id.zw_streak, "\uD83D\uDD25 " + d.optInt("streak", 0));
        rv.setTextColor(R.id.zw_streak, accent);
        rv.setTextViewText(R.id.zw_label, d.optString("streakLabel", ""));
        JSONArray tasks = d.optJSONArray("tasks");
        rows(rv, new int[]{R.id.zw_next}, tasks, true, d.optString("emptyT", ""));
    }
}

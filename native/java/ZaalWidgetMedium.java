package com.varee20.zaalmini;

import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Medium widget (4x2): the next three tasks. */
public class ZaalWidgetMedium extends ZaalWidgetBase {

    @Override
    protected int layoutId() {
        return R.layout.zw_medium;
    }

    @Override
    protected void fill(Context c, RemoteViews rv, JSONObject d, int accent) {
        rv.setTextViewText(R.id.zw_h2, d.optString("hNext", ""));
        rv.setTextColor(R.id.zw_h2, accent);
        rows(rv, new int[]{R.id.zw_t1, R.id.zw_t2, R.id.zw_t3}, d.optJSONArray("tasks"), true, d.optString("emptyT", ""));
    }
}

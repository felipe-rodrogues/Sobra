package com.sobra.finance;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "SobraNotificationListener")
public class SobraNotificationPlugin extends Plugin {
    private static SobraNotificationPlugin instance;
    private static final String PREFS_NAME = "sobra_notifications_queue";
    private static final String KEY_PENDING = "pending_list";

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void handleNotificationPosted(Context context, String title, String text, String packageName, long postTime) {
        // 1. Notifica em tempo real se o app estiver aberto com o plugin carregado
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("title", title);
            data.put("text", text);
            data.put("packageName", packageName);
            data.put("postTime", postTime);
            instance.notifyListeners("notificationReceived", data);
        }

        // 2. Salva em fila local (SharedPreferences) para entrega garantida mesmo se app estiver fechado
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_PENDING, "[]");
            JSONArray array = new JSONArray(raw);

            JSONObject item = new JSONObject();
            item.put("title", title);
            item.put("text", text);
            item.put("packageName", packageName);
            item.put("postTime", postTime);
            array.put(item);

            prefs.edit().putString(KEY_PENDING, array.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @PluginMethod
    public void isPermissionGranted(PluginCall call) {
        Context context = getContext();
        boolean isGranted = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.getPackageName());
        JSObject ret = new JSObject();
        ret.put("granted", isGranted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("ERROR_OPENING_SETTINGS", e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingNotifications(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_PENDING, "[]");
            JSONArray array = new JSONArray(raw);
            
            // Limpa a fila após consumir
            prefs.edit().putString(KEY_PENDING, "[]").apply();

            JSArray result = new JSArray();
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                JSObject jsObj = new JSObject();
                jsObj.put("title", obj.optString("title"));
                jsObj.put("text", obj.optString("text"));
                jsObj.put("packageName", obj.optString("packageName"));
                jsObj.put("postTime", obj.optLong("postTime"));
                result.put(jsObj);
            }

            JSObject ret = new JSObject();
            ret.put("notifications", result);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("ERROR_GETTING_PENDING", e.getMessage());
        }
    }
}

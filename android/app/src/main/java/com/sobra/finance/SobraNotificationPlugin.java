package com.sobra.finance;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.util.Log;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import androidx.core.app.NotificationCompat;
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
    private static final String TAG = "SobraNotificationPlugin";
    private static SobraNotificationPlugin instance;
    private static final String PREFS_NAME = "sobra_notifications_queue";
    private static final String KEY_PENDING = "pending_list";
    private static final String PREFS_DIAGNOSTICS = "sobra_diagnostics";
    private static final String KEY_RECENT_LOGS = "recent_notification_logs";

    @Override
    public void load() {
        super.load();
        instance = this;
        autoReconnectIfGranted();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        autoReconnectIfGranted();
        if (instance != null) {
            instance.notifyListeners("appResumed", new JSObject());
        }
    }

    private void autoReconnectIfGranted() {
        try {
            Context ctx = getContext();
            if (ctx == null) return;
            boolean isGranted = NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.getPackageName());
            if (isGranted && !FinanceNotificationListenerService.isServiceConnected) {
                Log.d(TAG, "Permissão ativa mas serviço desconectado. Disparando auto-rebind...");
                triggerRebind(ctx);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro no autoReconnectIfGranted: " + e.getMessage());
        }
    }

    private static void triggerRebind(Context context) {
        if (context == null) return;
        try {
            // 1. requestRebind oficial do Android N+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                try {
                    NotificationListenerService.requestRebind(new ComponentName(context, FinanceNotificationListenerService.class));
                } catch (Exception ignored) {}
            }

            // 2. Toggle de componente via PackageManager (força o NotificationManagerService do Android a re-ler o serviço)
            PackageManager pm = context.getPackageManager();
            ComponentName cn = new ComponentName(context, FinanceNotificationListenerService.class);
            pm.setComponentEnabledSetting(cn, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            pm.setComponentEnabledSetting(cn, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao disparar rebind: " + e.getMessage());
        }
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

        // 2. Salva em fila persistente (SharedPreferences) para entrega garantida caso o WebView esteja em background
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
        ret.put("connected", FinanceNotificationListenerService.isServiceConnected);
        call.resolve(ret);
    }

    @PluginMethod
    public void getServiceStatus(PluginCall call) {
        Context context = getContext();
        boolean isGranted = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.getPackageName());
        
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean isIgnoringBattery = false;
        if (pm != null) {
            isIgnoringBattery = pm.isIgnoringBatteryOptimizations(context.getPackageName());
        }

        JSObject ret = new JSObject();
        ret.put("granted", isGranted);
        ret.put("connected", FinanceNotificationListenerService.isServiceConnected);
        ret.put("isIgnoringBattery", isIgnoringBattery);
        call.resolve(ret);
    }

    @PluginMethod
    public void reconnectService(PluginCall call) {
        Context context = getContext();
        triggerRebind(context);
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("connected", FinanceNotificationListenerService.isServiceConnected);
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
    public void isBatteryOptimizationIgnored(PluginCall call) {
        Context context = getContext();
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean isIgnoring = false;
        if (pm != null) {
            isIgnoring = pm.isIgnoringBatteryOptimizations(context.getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("ignored", isIgnoring);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        try {
            Context context = getContext();
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(context.getPackageName())) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("ERROR_REQUEST_BATTERY", e.getMessage());
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

    @PluginMethod
    public void getDiagnosticLogs(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_DIAGNOSTICS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_RECENT_LOGS, "[]");
            JSONArray array = new JSONArray(raw);

            JSArray result = new JSArray();
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                JSObject item = new JSObject();
                item.put("id", obj.optString("id"));
                item.put("packageName", obj.optString("packageName"));
                item.put("title", obj.optString("title"));
                item.put("text", obj.optString("text"));
                item.put("timestamp", obj.optLong("timestamp"));
                item.put("status", obj.optString("status"));
                result.put(item);
            }

            JSObject ret = new JSObject();
            ret.put("logs", result);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("ERROR_GETTING_LOGS", e.getMessage());
        }
    }

    @PluginMethod
    public void clearDiagnosticLogs(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_DIAGNOSTICS, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_RECENT_LOGS, "[]").apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("ERROR_CLEARING_LOGS", e.getMessage());
        }
    }

    @PluginMethod
    public void sendLocalNotification(PluginCall call) {
        String title = call.getString("title", "Sobra - Controle Financeiro");
        String text = call.getString("text", "");
        Context context = getContext();

        try {
            String channelId = "sobra_transactions_channel";
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "Transações e Notificações Sobra",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Notificações para confirmação de Pix e transações financeiras");
                channel.enableLights(true);
                channel.enableVibration(true);
                if (notificationManager != null) {
                    notificationManager.createNotificationChannel(channel);
                }
            }

            Intent intent = new Intent(context, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                (int) System.currentTimeMillis(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

            if (notificationManager != null) {
                notificationManager.notify((int) (System.currentTimeMillis() % 100000), builder.build());
            }

            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Erro ao disparar notificacao local: " + e.getMessage());
            call.reject("ERROR_LOCAL_NOTIFICATION", e.getMessage());
        }
    }
}

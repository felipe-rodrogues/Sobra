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
import android.Manifest;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
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
    private static JSObject pendingTapData = null;
    public static boolean isAppInForeground = false;
    private static final String PREFS_NAME = "sobra_notifications_queue";
    private static final String KEY_PENDING = "pending_list";
    private static final String PREFS_DIAGNOSTICS = "sobra_diagnostics";
    private static final String KEY_RECENT_LOGS = "recent_notification_logs";

    public static void setAppForeground(boolean foreground) {
        isAppInForeground = foreground;
    }

    public static String getBankName(String packageName) {
        if (packageName == null) return "Banco";
        String pkg = packageName.toLowerCase();
        if (pkg.contains("nu") || pkg.contains("nubank")) return "Nubank";
        if (pkg.contains("itau") || pkg.contains("iti")) return "Itaú";
        if (pkg.contains("bradesco") || pkg.contains("next")) return "Bradesco";
        if (pkg.contains("bb") || pkg.contains("ourocard")) return "Banco do Brasil";
        if (pkg.contains("caixa")) return "Caixa";
        if (pkg.contains("santander") || pkg.contains("way")) return "Santander";
        if (pkg.contains("inter")) return "Banco Inter";
        if (pkg.contains("c6")) return "C6 Bank";
        if (pkg.contains("mercadopago")) return "Mercado Pago";
        if (pkg.contains("picpay")) return "PicPay";
        if (pkg.contains("btg")) return "BTG Pactual";
        if (pkg.contains("neon")) return "Neon";
        if (pkg.contains("pagseguro") || pkg.contains("uol.ps")) return "PagBank";
        if (pkg.contains("amedigital")) return "Ame";
        if (pkg.contains("bancopan")) return "Banco Pan";
        if (pkg.contains("original")) return "Banco Original";
        if (pkg.contains("xp")) return "XP Investimentos";
        if (pkg.contains("sicoob")) return "Sicoob";
        if (pkg.contains("sicredi")) return "Sicredi";
        if (pkg.contains("bv")) return "BV";
        if (pkg.contains("safra")) return "Safra";
        if (pkg.contains("digio")) return "Digio";
        if (pkg.contains("credicard")) return "Credicard";
        return "Banco";
    }

    public static double extractAmount(String text) {
        if (text == null || text.isEmpty()) return 0.0;
        try {
            java.util.regex.Pattern p = java.util.regex.Pattern.compile("r\\$\\s*([\\d\\.,]+)", java.util.regex.Pattern.CASE_INSENSITIVE);
            java.util.regex.Matcher m = p.matcher(text);
            if (m.find()) {
                String raw = m.group(1).trim();
                if (raw.contains(",") && raw.contains(".")) {
                    raw = raw.replace(".", "").replace(",", ".");
                } else if (raw.contains(",")) {
                    raw = raw.replace(",", ".");
                }
                return Double.parseDouble(raw);
            }
        } catch (Exception ignored) {}
        return 0.0;
    }

    @Override
    public void load() {
        super.load();
        instance = this;
        isAppInForeground = true;
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

    public static void handleLaunchIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra("action");
        if (action != null && action.equals("open_transaction")) {
            JSObject data = new JSObject();
            data.put("action", action);
            data.put("transactionId", intent.getStringExtra("transaction_id"));
            data.put("notificationId", intent.getStringExtra("notification_id"));
            data.put("amount", intent.getDoubleExtra("amount", 0.0));
            data.put("merchant", intent.getStringExtra("merchant"));
            data.put("bankName", intent.getStringExtra("bank_name"));
            data.put("rawText", intent.getStringExtra("raw_text"));
            data.put("rawTitle", intent.getStringExtra("raw_title"));
            data.put("packageName", intent.getStringExtra("package_name"));
            data.put("type", intent.getStringExtra("type"));
            data.put("requiresAccountRegistration", intent.getBooleanExtra("requires_account_registration", false));
            data.put("timestamp", intent.getLongExtra("timestamp", System.currentTimeMillis()));

            pendingTapData = data;

            if (instance != null) {
                instance.notifyListeners("notificationTapped", data);
            }
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

        // 2. Se o app NÃO estiver em primeiro plano (fechado, minimizado, tela desligada ou em outro app),
        // dispara IMEDIATAMENTE a notificação nativa pelo Android para o usuário não depender do ciclo de vida da WebView/JS
        if (!isAppInForeground) {
            boolean isIncome = false;
            String lowerCombined = ((title != null ? title : "") + " " + (text != null ? text : "")).toLowerCase();
            if (lowerCombined.contains("recebeu") || lowerCombined.contains("recebido") || 
                lowerCombined.contains("depósito") || lowerCombined.contains("deposito") ||
                lowerCombined.contains("salário") || lowerCombined.contains("salario") ||
                (lowerCombined.contains("pix") && (lowerCombined.contains("recebido") || lowerCombined.contains("você recebeu") || lowerCombined.contains("voce recebeu") || lowerCombined.contains("de ")))) {
                isIncome = true;
            }

            double amount = extractAmount(text);
            if (amount <= 0.0) {
                amount = extractAmount(title);
            }
            String bankName = getBankName(packageName);
            String formattedAmount = amount > 0 ? String.format(java.util.Locale.GERMANY, "%.2f", amount) : "";

            String notifTitle;
            if (isIncome) {
                notifTitle = amount > 0 
                    ? "💰 Pix / Entrada: R$ " + formattedAmount 
                    : "💰 Entrada / Pix Detectado (" + bankName + ")";
            } else {
                notifTitle = amount > 0 
                    ? "💳 Compra no " + bankName + ": R$ " + formattedAmount 
                    : "💳 Compra detectada no " + bankName;
            }

            String notifText = isIncome 
                ? (title != null && !title.isEmpty() ? title + " - " : "") + text + "\nToque para confirmar a inclusão como receita no Sobra."
                : (title != null && !title.isEmpty() ? title + " - " : "") + text + "\nToque para conferir ou editar no Sobra.";

            postLocalNotification(
                context,
                notifTitle,
                notifText,
                null,
                null,
                amount,
                null,
                bankName,
                text,
                title,
                packageName,
                false,
                isIncome ? "income" : "expense"
            );
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

        boolean notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled();

        JSObject ret = new JSObject();
        ret.put("granted", isGranted);
        ret.put("connected", FinanceNotificationListenerService.isServiceConnected);
        ret.put("isIgnoringBattery", isIgnoringBattery);
        ret.put("notificationsEnabled", notificationsEnabled);
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
    public void getPendingNotificationTap(PluginCall call) {
        JSObject ret = new JSObject();
        if (pendingTapData != null) {
            ret.put("tap", pendingTapData);
            pendingTapData = null; // consume
        } else {
            ret.put("tap", null);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getActivity() != null) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 102);
            }
        }
        boolean enabled = NotificationManagerCompat.from(context).areNotificationsEnabled();
        JSObject ret = new JSObject();
        ret.put("granted", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        Context context = getContext();
        boolean enabled = NotificationManagerCompat.from(context).areNotificationsEnabled();
        JSObject ret = new JSObject();
        ret.put("granted", enabled);
        call.resolve(ret);
    }

    public static void postLocalNotification(
        Context context,
        String title,
        String text,
        String transactionId,
        String notificationId,
        double amount,
        String merchant,
        String bankName,
        String rawText,
        String rawTitle,
        String packageName,
        boolean requiresAccountRegistration,
        String type
    ) {
        if (context == null) return;
        try {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            String channelId = "sobra_transactions_channel";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "Transações e Compras Sobra",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Notificações de compras detectadas e lançamentos no cartão");
                channel.enableLights(true);
                channel.enableVibration(true);
                channel.setShowBadge(true);
                notificationManager.createNotificationChannel(channel);
            }

            Intent intent = new Intent(context, MainActivity.class);
            intent.setAction("com.sobra.finance.ACTION_OPEN_TRANSACTION");
            intent.putExtra("action", "open_transaction");
            if (transactionId != null) intent.putExtra("transaction_id", transactionId);
            if (notificationId != null) intent.putExtra("notification_id", notificationId);
            intent.putExtra("amount", amount);
            if (merchant != null) intent.putExtra("merchant", merchant);
            if (bankName != null) intent.putExtra("bank_name", bankName);
            if (rawText != null) intent.putExtra("raw_text", rawText);
            if (rawTitle != null) intent.putExtra("raw_title", rawTitle);
            if (packageName != null) intent.putExtra("package_name", packageName);
            if (type != null) intent.putExtra("type", type);
            intent.putExtra("requires_account_registration", requiresAccountRegistration);
            intent.putExtra("timestamp", System.currentTimeMillis());
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

            int requestCode;
            if (rawText != null && !rawText.trim().isEmpty()) {
                requestCode = Math.abs(rawText.hashCode() % 900000) + 10000;
            } else if (title != null && !title.trim().isEmpty()) {
                requestCode = Math.abs(title.hashCode() % 900000) + 10000;
            } else {
                requestCode = (int) (System.currentTimeMillis() % 100000);
            }
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(context, requestCode, intent, flags);

            int smallIcon = context.getApplicationInfo().icon;
            if (smallIcon == 0) {
                smallIcon = android.R.drawable.ic_dialog_info;
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(smallIcon)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

            notificationManager.notify(requestCode, builder.build());
            Log.d(TAG, "Notificação local disparada com sucesso: " + title);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao disparar notificação local: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void sendLocalNotification(PluginCall call) {
        String title = call.getString("title", "Sobra - Controle Financeiro");
        String text = call.getString("text", "");
        String transactionId = call.getString("transactionId", null);
        String notificationId = call.getString("notificationId", null);
        Double amount = call.getDouble("amount", 0.0);
        String merchant = call.getString("merchant", null);
        String bankName = call.getString("bankName", null);
        String rawText = call.getString("rawText", null);
        String rawTitle = call.getString("rawTitle", null);
        String packageName = call.getString("packageName", null);
        Boolean requiresAccountRegistration = call.getBoolean("requiresAccountRegistration", false);
        String type = call.getString("type", null);

        postLocalNotification(
            getContext(),
            title,
            text,
            transactionId,
            notificationId,
            amount != null ? amount : 0.0,
            merchant,
            bankName,
            rawText,
            rawTitle,
            packageName,
            requiresAccountRegistration != null && requiresAccountRegistration,
            type
        );
        call.resolve();
    }
}

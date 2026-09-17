package com.sobra.finance;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class FinanceNotificationListenerService extends NotificationListenerService {
    private static final String TAG = "SobraNotificationSvc";
    private static final String PREFS_DIAGNOSTICS = "sobra_diagnostics";
    private static final String KEY_RECENT_LOGS = "recent_notification_logs";
    private static final int MAX_LOGS = 25;

    // Estado da conexão em memória
    public static volatile boolean isServiceConnected = false;

    // Cache para debounce de notificações repetidas em curtíssimo intervalo (2 segundos)
    private static final Map<String, Long> RECENT_KEYS = new LinkedHashMap<String, Long>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
            return size() > 100;
        }
    };

    // Carteiras digitais expressamente ignoradas para evitar duplicações e falta de metadados bancários
    private static final Set<String> EXCLUDED_PACKAGES = new HashSet<>(Arrays.asList(
        "com.samsung.android.spay",
        "com.samsung.android.raja.service",
        "com.google.android.apps.walletnfcrel",
        "com.google.android.gms"
    ));

    // Pacotes bancários monitorados — ampla cobertura nacional
    private static final Set<String> MONITORED_PACKAGES = new HashSet<>(Arrays.asList(
        // Nubank
        "com.nu.production", "com.nubank",
        // Itaú & iti
        "com.itau", "com.itau.personnalite", "com.itau.cartoes", "com.iti.iti",
        // Bradesco & Next
        "com.bradesco", "com.bradesco.cartoes", "br.com.bradesco.next",
        // Banco do Brasil & Ourocard
        "br.com.bb.android", "br.com.bb.ourocard",
        // Caixa Econômica Federal & Caixa Tem
        "br.com.gabba.Caixa", "br.gov.caixa.tem", "br.gov.caixa.cartoes",
        // Santander & Way
        "com.santander.app", "com.santander.way",
        // Banco Inter
        "br.com.intermedium", "com.bancointer.bancointer",
        // C6 Bank
        "com.c6bank.app",
        // Mercado Pago
        "com.mercadopago.wallet",
        // PicPay
        "com.picpay",
        // BTG Pactual
        "com.btg.pactual.banking",
        // Neon
        "br.com.neon",
        // PagBank (PagSeguro)
        "br.com.uol.ps.myaccount",
        // Ame Digital
        "com.amedigital.wallet",
        // Banco Pan
        "br.com.bancopan",
        // Banco Original
        "br.com.original",
        // XP Investimentos
        "br.com.xp.cartao", "com.xpi.cartoes",
        // Sicoob
        "br.com.sicoob.sisbrmobile",
        // Sicredi
        "br.com.sicredi",
        // Banco BV
        "br.com.bv",
        // Banco Safra
        "br.com.safra",
        // Sofisa Direto
        "br.com.sofisa.sofisadireto",
        // Will Bank
        "com.mobicare.meupag",
        // Nomad
        "com.nomadfinance.app",
        // Wise
        "com.transferwise.android",
        // RecargaPay
        "com.recargapay",
        // Digio
        "br.com.digio",
        // Credicard
        "com.credicard.app",
        // Porto Seguro
        "br.com.portoseguro.cartoes",
        // Banrisul
        "br.com.banrisul.mobile"
    ));

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Assegura reinício automático em caso de falta temporária de memória
        return START_STICKY;
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        isServiceConnected = true;
        Log.d(TAG, "NotificationListenerService conectado e ativo no Android!");
        recordDiagnostic(getApplicationContext(), "SYSTEM", "Serviço Conectado", "O serviço do Sobra foi vinculado com sucesso ao Android.", "connected");
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        isServiceConnected = false;
        Log.w(TAG, "NotificationListenerService desconectado. Tentando auto-rebind...");
        recordDiagnostic(getApplicationContext(), "SYSTEM", "Serviço Desconectado", "O Android desconectou o serviço. Solicitando auto-rebind imediato.", "disconnected");

        // Solicita ao Android re-vínculo imediato do listener
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                requestRebind(new ComponentName(this, FinanceNotificationListenerService.class));
            } catch (Exception e) {
                Log.e(TAG, "Falha no auto-rebind: " + e.getMessage());
            }
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        super.onNotificationPosted(sbn);
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if (packageName == null) return;

        // 1. Bloqueia expressamente carteiras genéricas solicitadas pelo usuário (Samsung Pay, Google Wallet)
        if (EXCLUDED_PACKAGES.contains(packageName)) {
            Log.d(TAG, "Ignorando carteira genérica expressamente excluída: " + packageName);
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        // 2. Extração profunda e segura de todos os campos de texto possíveis
        CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence titleBigCs = extras.getCharSequence(Notification.EXTRA_TITLE_BIG);
        CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence subTextCs = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
        CharSequence infoTextCs = extras.getCharSequence(Notification.EXTRA_INFO_TEXT);
        CharSequence tickerCs = notification.tickerText;

        String title = "";
        if (titleBigCs != null && titleBigCs.length() > 0) {
            title = titleBigCs.toString().trim();
        } else if (titleCs != null) {
            title = titleCs.toString().trim();
        }

        StringBuilder textBuilder = new StringBuilder();
        String primaryText = textCs != null ? textCs.toString().trim() : "";
        String bigText = bigTextCs != null ? bigTextCs.toString().trim() : "";
        String subText = subTextCs != null ? subTextCs.toString().trim() : "";
        String infoText = infoTextCs != null ? infoTextCs.toString() : "";
        String ticker = tickerCs != null ? tickerCs.toString().trim() : "";

        // Monta o texto composto garantindo que valores e descrições não se percam
        if (!primaryText.isEmpty() && !bigText.isEmpty()) {
            if (bigText.contains(primaryText)) {
                textBuilder.append(bigText);
            } else if (primaryText.contains(bigText)) {
                textBuilder.append(primaryText);
            } else {
                textBuilder.append(primaryText).append(" ").append(bigText);
            }
        } else if (!bigText.isEmpty()) {
            textBuilder.append(bigText);
        } else if (!primaryText.isEmpty()) {
            textBuilder.append(primaryText);
        }

        if (!subText.isEmpty() && !textBuilder.toString().contains(subText)) {
            textBuilder.append(" ").append(subText);
        }
        if (!ticker.isEmpty() && !textBuilder.toString().contains(ticker)) {
            textBuilder.append(" ").append(ticker);
        }

        String fullText = textBuilder.toString().trim();
        if (title.isEmpty() && fullText.isEmpty()) return;

        String combinedLower = (title + " " + fullText).toLowerCase(Locale.ROOT);

        // 3. Validação de origem: banco cadastrado OU heurística financeira de fallback
        boolean isBank = MONITORED_PACKAGES.contains(packageName);
        boolean hasFinancialKeywords = combinedLower.contains("r$") && (
            combinedLower.contains("compra") ||
            combinedLower.contains("aprovad") ||
            combinedLower.contains("pix") ||
            combinedLower.contains("cartao") ||
            combinedLower.contains("cartão") ||
            combinedLower.contains("debito") ||
            combinedLower.contains("débito") ||
            combinedLower.contains("credito") ||
            combinedLower.contains("crédito") ||
            combinedLower.contains("pago") ||
            combinedLower.contains("pagamento") ||
            combinedLower.contains("transferencia") ||
            combinedLower.contains("transferência") ||
            combinedLower.contains("fatura")
        );

        if (!isBank && !hasFinancialKeywords) {
            // Notificação irrelevante (WhatsApp, jogos, redes sociais etc.)
            return;
        }

        // 4. Debounce de Sistema: evita duplicação imediata do próprio Android em menos de 2 segundos
        String notificationKey = packageName + "||" + title + "||" + fullText;
        long now = System.currentTimeMillis();
        synchronized (RECENT_KEYS) {
            Long lastSeen = RECENT_KEYS.get(notificationKey);
            if (lastSeen != null && (now - lastSeen) < 2000) {
                Log.d(TAG, "Notificação idêntica suprimida pelo debounce do Android: " + packageName);
                recordDiagnostic(getApplicationContext(), packageName, title, fullText, "debounced");
                return;
            }
            RECENT_KEYS.put(notificationKey, now);
        }

        Log.d(TAG, "Notificação bancária válida capturada: [" + packageName + "] " + title + " -> " + fullText);
        recordDiagnostic(getApplicationContext(), packageName, title, fullText, "captured");

        // 5. Encaminha para o plugin e salva na fila persistente
        SobraNotificationPlugin.handleNotificationPosted(
            getApplicationContext(),
            title,
            fullText,
            packageName,
            sbn.getPostTime()
        );
    }

    private static synchronized void recordDiagnostic(Context context, String pkg, String title, String text, String status) {
        if (context == null) return;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_DIAGNOSTICS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY_RECENT_LOGS, "[]");
            JSONArray array = new JSONArray(raw);

            JSONObject logItem = new JSONObject();
            logItem.put("id", "log-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 1000));
            logItem.put("packageName", pkg);
            logItem.put("title", title);
            logItem.put("text", text);
            logItem.put("timestamp", System.currentTimeMillis());
            logItem.put("status", status);

            // Adiciona no início (mais recente primeiro)
            JSONArray newArray = new JSONArray();
            newArray.put(logItem);
            for (int i = 0; i < Math.min(array.length(), MAX_LOGS - 1); i++) {
                newArray.put(array.get(i));
            }

            prefs.edit().putString(KEY_RECENT_LOGS, newArray.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Erro ao registrar log de diagnóstico: " + e.getMessage());
        }
    }
}

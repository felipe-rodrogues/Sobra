package com.sobra.finance;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class FinanceNotificationListenerService extends NotificationListenerService {
    private static final String TAG = "SobraNotificationSvc";

    // Pacotes bancários monitorados — sincronizado com bankCatalog.ts
    private static final Set<String> MONITORED_PACKAGES = new HashSet<>(Arrays.asList(
        // Nubank
        "com.nu.production", "com.nubank",
        // Itaú & iti
        "com.itau", "com.itau.personnalite", "com.itau.cartoes", "com.iti.iti",
        // Bradesco
        "com.bradesco", "com.bradesco.cartoes",
        // Digio
        "br.com.digio",
        // Banco do Brasil
        "br.com.bb.android",
        // Caixa Econômica Federal
        "br.com.gabba.Caixa",
        // Santander
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
        // Banco Next
        "br.com.bradesco.next",
        // Sofisa Direto
        "br.com.sofisa.sofisadireto"
    ));

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        Log.d(TAG, "NotificationListenerService conectado e ativo no Android.");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        super.onNotificationPosted(sbn);
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if (!MONITORED_PACKAGES.contains(packageName)) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String title = titleCs != null ? titleCs.toString() : "";
        String text = bigTextCs != null ? bigTextCs.toString() : (textCs != null ? textCs.toString() : "");

        if (title.isEmpty() && text.isEmpty()) return;

        Log.d(TAG, "Notificação bancária capturada: [" + packageName + "] " + title + " -> " + text);

        SobraNotificationPlugin.handleNotificationPosted(
            getApplicationContext(),
            title,
            text,
            packageName,
            sbn.getPostTime()
        );
    }
}

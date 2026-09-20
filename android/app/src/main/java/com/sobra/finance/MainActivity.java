package com.sobra.finance;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SobraNotificationPlugin.class);
        super.onCreate(savedInstanceState);

        // Solicita permissão de envio de notificações no Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 102);
            }
        }

        SobraNotificationPlugin.handleLaunchIntent(getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        SobraNotificationPlugin.setAppForeground(true);
    }

    @Override
    protected void onPause() {
        super.onPause();
        SobraNotificationPlugin.setAppForeground(false);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        SobraNotificationPlugin.setAppForeground(false);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        SobraNotificationPlugin.handleLaunchIntent(intent);
    }
}

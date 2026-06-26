package com.await.com;

import android.graphics.Color;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Paint the WebView cream so there's no black frame before the
        // remote page (and the AwaitSplash overlay) first renders.
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(Color.parseColor("#f4f2ea"));
        }
    }
}

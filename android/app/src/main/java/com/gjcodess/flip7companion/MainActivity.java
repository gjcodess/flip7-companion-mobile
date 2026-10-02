package com.gjcodess.flip7companion;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(TvServerPlugin.class);
        registerPlugin(ResultsImagePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

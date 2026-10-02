package com.gjcodess.flip7companion;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(TvServerPlugin.class);
        registerPlugin(ResultsImagePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

package com.gjcodess.flip7companion;

import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanIntentResult;
import com.journeyapps.barcodescanner.ScanOptions;

@CapacitorPlugin(name = "QrScanner")
public class QrScannerPlugin extends Plugin {
    @PluginMethod
    public void scan(PluginCall call) {
        ScanOptions options = new ScanOptions();
        options.setDesiredBarcodeFormats(ScanOptions.QR_CODE);
        options.setPrompt("Scan the QR code on the host's phone");
        options.setBeepEnabled(false);
        options.setBarcodeImageEnabled(false);
        startActivityForResult(call, options.createScanIntent(getActivity()), "handleScan");
    }

    @ActivityCallback
    public void handleScan(PluginCall call, ActivityResult result) {
        ScanIntentResult scan = new ScanContract().parseResult(result.getResultCode(), result.getData());
        JSObject response = new JSObject();
        response.put("text", scan.getContents() == null ? "" : scan.getContents());
        call.resolve(response);
    }
}

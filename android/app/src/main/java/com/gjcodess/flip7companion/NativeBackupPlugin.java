package com.gjcodess.flip7companion;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeBackup")
public class NativeBackupPlugin extends Plugin {

    private String safeFileName(PluginCall call) {
        String name = call.getString("fileName", "flip7-backup.json");
        name = name.replaceAll("[^A-Za-z0-9._-]", "-");
        if (!name.endsWith(".json")) name += ".json";
        return name;
    }

    private byte[] jsonBytes(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) throw new IllegalArgumentException("Backup data is empty.");
        return data.getBytes(StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void shareBackup(PluginCall call) {
        try {
            byte[] bytes = jsonBytes(call);
            File directory = new File(getContext().getCacheDir(), "backups");
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IllegalStateException("Could not prepare the backup for saving.");
            }
            File file = new File(directory, safeFileName(call));
            try (FileOutputStream output = new FileOutputStream(file)) {
                output.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/json");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_TEXT, call.getString("text", "Flip7 Companion game backup"));
            send.setClipData(ClipData.newRawUri("Flip7 Backup", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(send, "Save or Share Flip7 Backup"));
            JSObject response = new JSObject();
            response.put("success", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Could not export backup: " + error.getMessage());
        }
    }
}

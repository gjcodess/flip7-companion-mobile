package com.gjcodess.flip7companion;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "ResultsImage")
public class ResultsImagePlugin extends Plugin {
    private static final String PNG_PREFIX = "data:image/png;base64,";

    private byte[] imageBytes(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        if (dataUrl == null || !dataUrl.startsWith(PNG_PREFIX)) throw new IllegalArgumentException("Invalid results image.");
        byte[] bytes = Base64.decode(dataUrl.substring(PNG_PREFIX.length()), Base64.DEFAULT);
        if (bytes.length == 0 || bytes.length > 15_000_000) throw new IllegalArgumentException("Results image is too large.");
        return bytes;
    }

    private String safeFileName(PluginCall call) {
        String name = call.getString("fileName", "flip7-results.png");
        name = name.replaceAll("[^A-Za-z0-9._-]", "-");
        if (!name.endsWith(".png")) name += ".png";
        return name;
    }

    @PluginMethod
    public void shareImage(PluginCall call) {
        try {
            byte[] bytes = imageBytes(call);
            File directory = new File(getContext().getCacheDir(), "results");
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Could not prepare the image for sharing.");
            File image = new File(directory, safeFileName(call));
            try (FileOutputStream output = new FileOutputStream(image)) { output.write(bytes); }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", image);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_TEXT, call.getString("text", "Flip7 Companion game results"));
            send.setClipData(ClipData.newRawUri("Flip7 results", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(send, "Share game results"));
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not share the results image: " + error.getMessage());
        }
    }

    @PluginMethod
    public void saveImage(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            save.addCategory(Intent.CATEGORY_OPENABLE);
            save.setType("image/png");
            save.putExtra(Intent.EXTRA_TITLE, safeFileName(call));
            startActivityForResult(call, save, "saveLegacyImage");
            return;
        }
        Uri uri = null;
        ContentResolver resolver = getContext().getContentResolver();
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, safeFileName(call));
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Flip7 Companion");
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
            uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("Could not create the image file.");
            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("Could not write the image file.");
                output.write(imageBytes(call));
            }
            values.clear();
            values.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            JSObject result = new JSObject();
            result.put("location", "Pictures/Flip7 Companion");
            call.resolve(result);
        } catch (Exception error) {
            if (uri != null) resolver.delete(uri, null, null);
            call.reject("Could not save the results image: " + error.getMessage());
        }
    }

    @ActivityCallback
    private void saveLegacyImage(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("Image save canceled.");
            return;
        }
        try (OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData())) {
            if (output == null) throw new IllegalStateException("Could not write the image file.");
            output.write(imageBytes(call));
            JSObject response = new JSObject();
            response.put("location", "the chosen folder");
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Could not save the results image: " + error.getMessage());
        }
    }
}

package com.gjcodess.flip7companion;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.lang.reflect.*;
import java.net.*;
import java.security.*;
import java.util.concurrent.*;
import javax.crypto.AEADBadTagException;
import static org.junit.Assert.*;

/** Exercise the actual Android crypto provider, socket framing, native client and JS inbox bridge. */
@RunWith(AndroidJUnit4.class)
public class SharedRoomTransportTest {
    @Test public void joiningScreenLoadsInsideTheAndroidApp() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/join"));
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
            String text = "";
            while (System.nanoTime() < deadline) {
                CompletableFuture<String> body = new CompletableFuture<>();
                scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript("document.body.innerText", body::complete));
                text = body.get(2, TimeUnit.SECONDS);
                if (text.contains("Scan room QR")) break;
                Thread.sleep(150);
            }
            assertTrue("Native join route should load: " + text, text.contains("Scan room QR"));
            assertTrue(text.contains("Read a QR photo"));
            assertFalse(text.contains("Joining is available in the Android app"));
            android.graphics.Bitmap image = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            if (image != null) {
                java.io.File output = new java.io.File(InstrumentationRegistry.getInstrumentation().getTargetContext().getCacheDir(), "shared-room-join.png");
                try (java.io.FileOutputStream stream = new java.io.FileOutputStream(output)) { image.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, stream); }
                image.recycle();
            }
        }
    }
    private static class Capture extends PluginCall {
        final CompletableFuture<JSObject> result = new CompletableFuture<>();
        Capture(String method, JSObject args) { super(null, "SharedRoom", "test", method, args); }
        @Override public void resolve(JSObject data) { result.complete(data); }
        @Override public void resolve() { result.complete(new JSObject()); }
        @Override public void reject(String message) { result.completeExceptionally(new IllegalStateException(message)); }
    }
    private static void field(Object instance, String name, Object value) throws Exception {
        Field field = SharedRoomPlugin.class.getDeclaredField(name); field.setAccessible(true); field.set(instance, value);
    }
    private static void shutdown(SharedRoomPlugin plugin) throws Exception {
        Field field = SharedRoomPlugin.class.getDeclaredField("workers"); field.setAccessible(true); ((ExecutorService) field.get(plugin)).shutdownNow();
    }
    @Test public void encryptedNativeExchangeRoundTripsThroughHostInbox() throws Exception {
        SharedRoomPlugin host = new SharedRoomPlugin(), client = new SharedRoomPlugin();
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(2048); KeyPair pair = generator.generateKeyPair();
        field(host, "keys", pair); field(host, "hostedRoom", "transport-test"); field(host, "invitationSecret", "test-invitation");
        Method find = SharedRoomPlugin.class.getDeclaredMethod("findAddress"); find.setAccessible(true);
        InetAddress address = (InetAddress) find.invoke(null);
        assertNotNull("Test needs the emulator Wi-Fi network", address);
        ServerSocket server = new ServerSocket(0, 2, address);
        ExecutorService accept = Executors.newSingleThreadExecutor();
        try {
            Method handle = SharedRoomPlugin.class.getDeclaredMethod("handle", Socket.class); handle.setAccessible(true);
            Future<?> handled = accept.submit(() -> { try { handle.invoke(host, server.accept()); } catch (Exception error) { throw new RuntimeException(error); } });
            JSObject request = new JSObject(); request.put("type", "poll"); request.put("deviceId", "device-test");
            JSObject args = new JSObject(); args.put("url", "http://" + address.getHostAddress() + ":" + server.getLocalPort() + "/room/transport-test");
            args.put("publicKey", android.util.Base64.encodeToString(pair.getPublic().getEncoded(), android.util.Base64.NO_WRAP)); args.put("invitationSecret", "test-invitation"); args.put("request", request);
            Capture outgoing = new Capture("request", args); client.request(outgoing);
            String messageId = null;
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(4);
            while (System.nanoTime() < deadline) {
                Capture drain = new Capture("drain", new JSObject()); host.drain(drain);
                org.json.JSONArray messages = drain.result.get().getJSONArray("messages");
                if (messages.length() > 0) {
                    messageId = messages.getJSONObject(0).getString("id");
                    assertEquals("poll", messages.getJSONObject(0).getJSONObject("request").getString("type"));
                    assertFalse(messages.getJSONObject(0).getJSONObject("request").has("invitationSecret"));
                    break;
                }
                Thread.sleep(30);
            }
            assertNotNull("Encrypted request should reach the host inbox", messageId);
            JSObject response = new JSObject(); response.put("ok", true); response.put("status", "approved"); response.put("revision", 8);
            JSObject reply = new JSObject(); reply.put("id", messageId); reply.put("response", response);
            host.reply(new Capture("reply", reply));
            JSObject received = outgoing.result.get(6, TimeUnit.SECONDS);
            assertTrue(received.getBoolean("ok")); assertEquals(8, received.getInt("revision"));
            handled.get(2, TimeUnit.SECONDS);
        } finally { server.close(); accept.shutdownNow(); shutdown(host); shutdown(client); }
    }
    @Test public void authenticatedEncryptionRejectsTamperedPayloads() throws Exception {
        Method aes = SharedRoomPlugin.class.getDeclaredMethod("aes", int.class, byte[].class, byte[].class, byte[].class); aes.setAccessible(true);
        byte[] key = new byte[32], nonce = new byte[12]; new SecureRandom().nextBytes(key); new SecureRandom().nextBytes(nonce);
        byte[] plain = "private seat credentials".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] encrypted = (byte[]) aes.invoke(null, javax.crypto.Cipher.ENCRYPT_MODE, key, nonce, plain);
        assertArrayEquals(plain, (byte[]) aes.invoke(null, javax.crypto.Cipher.DECRYPT_MODE, key, nonce, encrypted));
        encrypted[0] ^= 1;
        try { aes.invoke(null, javax.crypto.Cipher.DECRYPT_MODE, key, nonce, encrypted); fail("Tampering must fail authentication"); }
        catch (InvocationTargetException expected) { assertTrue(expected.getCause() instanceof AEADBadTagException); }
    }
}

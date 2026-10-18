package com.gjcodess.flip7companion;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.*;
import java.util.*;
import java.util.concurrent.*;
import javax.crypto.*;
import javax.crypto.spec.*;

/** Native LAN transport. Game permissions and durable transactions live in the host engine.
 * Requests use the host public key pinned in the QR invitation, with a fresh AES-GCM key
 * for every exchange. A Wi-Fi peer cannot read hands or steal reconnect credentials.
 */
@CapacitorPlugin(name = "SharedRoom")
public class SharedRoomPlugin extends Plugin {
    private final ExecutorService workers = new ThreadPoolExecutor(24, 24, 30, TimeUnit.SECONDS, new ArrayBlockingQueue<>(64), new ThreadPoolExecutor.AbortPolicy());
    private final ConcurrentLinkedQueue<Incoming> inbox = new ConcurrentLinkedQueue<>();
    private final Map<String, Incoming> pending = new ConcurrentHashMap<>();
    private final Set<Socket> sockets = ConcurrentHashMap.newKeySet();
    private final SecureRandom random = new SecureRandom();
    private volatile ServerSocket server;
    private volatile KeyPair keys;
    private volatile String hostedRoom;
    private volatile String invitationSecret;
    private volatile String address;
    private static final int MAX_BODY = 12 * 1024 * 1024;
    private static class Incoming {
        final String id = UUID.randomUUID().toString();
        final JSONObject request;
        final CompletableFuture<String> reply = new CompletableFuture<>();
        Incoming(JSONObject request) { this.request = request; }
    }
    private static String b64(byte[] bytes) { return Base64.encodeToString(bytes, Base64.NO_WRAP); }
    private static byte[] un64(String value) { return Base64.decode(value, Base64.DEFAULT); }
    private byte[] bytes(int count) { byte[] value = new byte[count]; random.nextBytes(value); return value; }
    private static Cipher rsa(int mode, Key key) throws Exception {
        Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPPadding");
        cipher.init(mode, key, new OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT));
        return cipher;
    }
    private static byte[] aes(int mode, byte[] key, byte[] iv, byte[] input) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        return cipher.doFinal(input);
    }
    private JSONObject seal(byte[] key, String plain) throws Exception {
        byte[] iv = bytes(12);
        return new JSONObject().put("iv", b64(iv)).put("data", b64(aes(Cipher.ENCRYPT_MODE, key, iv, plain.getBytes(StandardCharsets.UTF_8))));
    }
    private static String open(byte[] key, JSONObject sealed) throws Exception {
        return new String(aes(Cipher.DECRYPT_MODE, key, un64(sealed.getString("iv")), un64(sealed.getString("data"))), StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void start(PluginCall call) {
        workers.execute(() -> {
            synchronized (this) {
                try {
                    String room = call.getString("roomId");
                    if (room == null || !room.matches("[a-zA-Z0-9-]{1,80}")) throw new IOException("Invalid room.");
                    InetAddress lan = findAddress();
                    if (lan == null) throw new IOException("Connect to Wi-Fi or enable your hotspot first.");
                    if (server == null || server.isClosed() || !room.equals(hostedRoom) || !lan.getHostAddress().equals(address)) {
                        closeServer();
                        android.content.SharedPreferences prefs = getContext().getSharedPreferences("shared-room-host", 0);
                        int port = 0;
                        if (room.equals(prefs.getString("room", ""))) {
                            try {
                                KeyFactory factory = KeyFactory.getInstance("RSA");
                                keys = new KeyPair(factory.generatePublic(new X509EncodedKeySpec(un64(prefs.getString("public", "")))), factory.generatePrivate(new PKCS8EncodedKeySpec(un64(prefs.getString("private", "")))));
                                invitationSecret = prefs.getString("secret", "");
                                port = prefs.getInt("port", 0);
                            } catch (Exception ignored) { keys = null; }
                        }
                        if (keys == null) {
                            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(2048); keys = generator.generateKeyPair();
                            invitationSecret = b64(bytes(32));
                        }
                        ServerSocket listener = new ServerSocket(); listener.setReuseAddress(true);
                        try { listener.bind(new InetSocketAddress(lan, port), 24); }
                        catch (IOException occupied) { listener.close(); listener = new ServerSocket(0, 24, lan); }
                        server = listener; address = lan.getHostAddress(); hostedRoom = room;
                        prefs.edit().putString("room", room).putString("public", b64(keys.getPublic().getEncoded())).putString("private", b64(keys.getPrivate().getEncoded())).putString("secret", invitationSecret).putInt("port", server.getLocalPort()).apply();
                        final ServerSocket active = server;
                        Thread accept = new Thread(() -> accept(active), "flip7-room-listener"); accept.setDaemon(true); accept.start();
                    }
                    JSObject result = new JSObject();
                    result.put("url", "http://" + address + ":" + server.getLocalPort() + "/room/" + hostedRoom);
                    result.put("publicKey", b64(keys.getPublic().getEncoded()));
                    result.put("invitationSecret", invitationSecret);
                    getActivity().runOnUiThread(() -> getActivity().getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON));
                    call.resolve(result);
                } catch (Exception error) { closeServer(); call.reject("Could not host: " + error.getMessage()); }
            }
        });
    }
    @PluginMethod
    public void drain(PluginCall call) {
        JSONArray messages = new JSONArray();
        for (int i = 0; i < 32; i++) {
            Incoming incoming = inbox.poll(); if (incoming == null) break;
            if (pending.containsKey(incoming.id)) { JSObject message = new JSObject(); message.put("id", incoming.id); message.put("request", incoming.request); messages.put(message); }
        }
        JSObject result = new JSObject(); result.put("messages", messages); call.resolve(result);
    }
    @PluginMethod
    public void reply(PluginCall call) {
        Incoming incoming = pending.get(call.getString("id", ""));
        if (incoming != null) incoming.reply.complete(call.getObject("response", new JSObject()).toString());
        call.resolve();
    }
    @PluginMethod
    public void stop(PluginCall call) { synchronized (this) { closeServer(); } call.resolve(); }

    @PluginMethod
    public void request(PluginCall call) {
        workers.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(call.getString("url", ""));
                if (!url.getProtocol().equals("http") || url.getUserInfo() != null || !url.getHost().matches("[0-9.]+") || url.getQuery() != null || url.getRef() != null || !url.getPath().matches("/room/[a-zA-Z0-9-]{1,80}") || url.getPort() < 1) throw new IOException("Invalid local-room address.");
                InetAddress ip = InetAddress.getByName(url.getHost());
                if (!(ip instanceof Inet4Address) || !ip.isSiteLocalAddress() || ip.isLoopbackAddress()) throw new IOException("Rooms must use a local Wi-Fi or hotspot address.");
                PublicKey hostKey = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(un64(call.getString("publicKey", ""))));
                byte[] key = bytes(32);
                JSObject request = call.getObject("request", new JSObject());
                request.put("invitationSecret", call.getString("invitationSecret", ""));
                JSONObject body = seal(key, request.toString()).put("key", b64(rsa(Cipher.ENCRYPT_MODE, hostKey).doFinal(key)));
                byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
                connection = (HttpURLConnection) url.openConnection();
                connection.setInstanceFollowRedirects(false); connection.setRequestMethod("POST"); connection.setConnectTimeout(2500); connection.setReadTimeout(6000);
                connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json"); connection.setFixedLengthStreamingMode(data.length);
                try (OutputStream stream = connection.getOutputStream()) { stream.write(data); }
                if (connection.getResponseCode() != 200) throw new IOException("Host unavailable. Keep the host room open.");
                String response = new String(readBounded(connection.getInputStream(), MAX_BODY), StandardCharsets.UTF_8);
                call.resolve(JSObject.fromJSONObject(new JSONObject(open(key, new JSONObject(response)))));
            } catch (Exception error) { call.reject("Connection paused. Check the host and your Wi-Fi or hotspot."); }
            finally { if (connection != null) connection.disconnect(); }
        });
    }
    private void accept(ServerSocket listener) {
        while (!listener.isClosed()) {
            try {
                Socket socket = listener.accept(); socket.setSoTimeout(6000); sockets.add(socket);
                try { workers.execute(() -> handle(socket)); }
                catch (RejectedExecutionException busy) { sockets.remove(socket); socket.close(); }
            } catch (IOException ignored) { break; }
        }
    }
    private void handle(Socket socket) {
        Incoming incoming = null;
        try {
            InputStream input = socket.getInputStream();
            String first = line(input);
            if (!first.equals("POST /room/" + hostedRoom + " HTTP/1.1")) return;
            int length = -1;
            for (int count = 0; count < 32; count++) {
                String header = line(input); if (header.isEmpty()) break;
                if (header.toLowerCase(Locale.ROOT).startsWith("content-length:")) length = Integer.parseInt(header.substring(15).trim());
                if (count == 31) throw new IOException("Too many headers");
            }
            if (length < 1 || length > 32768) throw new IOException("Invalid request size");
            byte[] data = new byte[length]; int read = 0;
            while (read < length) { int n = input.read(data, read, length - read); if (n < 0) throw new EOFException(); read += n; }
            JSONObject sealed = new JSONObject(new String(data, StandardCharsets.UTF_8));
            KeyPair pair = keys;
            if (pair == null) return;
            byte[] key = rsa(Cipher.DECRYPT_MODE, pair.getPrivate()).doFinal(un64(sealed.getString("key")));
            JSONObject request = new JSONObject(open(key, sealed));
            if (!MessageDigest.isEqual(invitationSecret.getBytes(StandardCharsets.UTF_8), request.optString("invitationSecret").getBytes(StandardCharsets.UTF_8))) return;
            request.remove("invitationSecret");
            if (pending.size() >= 48) throw new IOException("Host busy");
            incoming = new Incoming(request); pending.put(incoming.id, incoming); inbox.add(incoming);
            String reply;
            try { reply = incoming.reply.get(4, TimeUnit.SECONDS); }
            catch (TimeoutException paused) { reply = "{\"ok\":false,\"error\":\"The host is paused. Ask them to reopen the room.\"}"; }
            byte[] body = seal(key, reply).toString().getBytes(StandardCharsets.UTF_8);
            OutputStream out = socket.getOutputStream();
            out.write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: " + body.length + "\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
            out.write(body); out.flush();
        } catch (Exception ignored) { /* Malformed or disconnected peers cannot change a room. */ }
        finally {
            if (incoming != null) { pending.remove(incoming.id); inbox.remove(incoming); }
            sockets.remove(socket); try { socket.close(); } catch (IOException ignored) {}
        }
    }
    private static String line(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        for (int i = 0; i < 8192; i++) {
            int b = input.read(); if (b < 0) throw new EOFException();
            if (b == '\n') return output.toString("US-ASCII").replace("\r", "");
            output.write(b);
        }
        throw new IOException("Header too long");
    }
    private static byte[] readBounded(InputStream input, int max) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] chunk = new byte[8192]; int n;
        while ((n = input.read(chunk)) != -1) { if (out.size() + n > max) throw new IOException("Response too large"); out.write(chunk, 0, n); }
        return out.toByteArray();
    }
    private static InetAddress findAddress() throws IOException {
        for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
            String name = network.getName().toLowerCase(Locale.ROOT);
            if (!network.isUp() || !(name.startsWith("wlan") || name.startsWith("ap") || name.startsWith("swlan"))) continue;
            for (InetAddress ip : Collections.list(network.getInetAddresses())) if (ip instanceof Inet4Address && ip.isSiteLocalAddress() && !ip.isLoopbackAddress()) return ip;
        }
        return null;
    }
    private synchronized void closeServer() {
        if (server != null) try { server.close(); } catch (IOException ignored) {}
        for (Socket socket : sockets) try { socket.close(); } catch (IOException ignored) {}
        for (Incoming request : pending.values()) request.reply.complete("{\"ok\":false,\"error\":\"Hosting stopped.\"}");
        sockets.clear(); pending.clear(); inbox.clear(); server = null; keys = null; hostedRoom = null; address = null;
        if (getActivity() != null) getActivity().runOnUiThread(() -> getActivity().getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON));
    }
    @Override protected void handleOnDestroy() { closeServer(); workers.shutdownNow(); }
}

package com.gjcodess.flip7companion;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "TvServer")
public class TvServerPlugin extends Plugin {
    private final ExecutorService workers = Executors.newCachedThreadPool();
    private final Set<Socket> viewers = ConcurrentHashMap.newKeySet();
    private final SecureRandom random = new SecureRandom();
    private volatile ServerSocket server;
    private volatile String roomId;
    private volatile String token;
    private volatile String snapshot;
    private volatile String url;

    @PluginMethod
    public synchronized void start(PluginCall call) {
        String requestedRoom = call.getString("roomId");
        JSObject initial = call.getObject("snapshot");
        if (requestedRoom == null || initial == null) { call.reject("Choose a room to show on the TV."); return; }
        try {
            InetAddress address = findWifiAddress();
            if (address == null) { call.reject("Connect your phone to Wi-Fi and your TV to the same local network, then try again."); return; }
            if (server != null && !server.isClosed() && requestedRoom.equals(roomId) && url != null && url.startsWith("http://" + address.getHostAddress() + ":")) {
                snapshot = initial.toString();
                workers.execute(this::broadcast);
            } else {
                closeServer();
                ServerSocket next = new ServerSocket(0, 16, address);
                server = next;
                roomId = requestedRoom;
                snapshot = initial.toString();
                token = newToken();
                url = "http://" + address.getHostAddress() + ":" + next.getLocalPort() + "/tv/" + token;
                workers.execute(() -> acceptViewers(next));
            }
            JSObject result = new JSObject();
            result.put("roomId", roomId);
            result.put("url", url);
            call.resolve(result);
        } catch (Exception error) {
            closeServer();
            call.reject("Could not start the local TV connection: " + error.getMessage());
        }
    }

    @PluginMethod
    public void publish(PluginCall call) {
        JSObject next = call.getObject("snapshot");
        if (next == null || !String.valueOf(call.getString("roomId")).equals(roomId) || server == null || server.isClosed()) {
            call.reject("The TV connection is no longer active.");
            return;
        }
        snapshot = next.toString();
        workers.execute(this::broadcast);
        call.resolve();
    }

    @PluginMethod
    public synchronized void stop(PluginCall call) {
        closeServer();
        call.resolve();
    }

    @Override
    protected synchronized void handleOnDestroy() {
        closeServer();
        workers.shutdownNow();
    }

    private static InetAddress findWifiAddress() throws IOException {
        for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
            String name = network.getName().toLowerCase(Locale.ROOT);
            if (!network.isUp() || !(name.startsWith("wlan") || name.startsWith("ap") || name.startsWith("swlan"))) continue;
            for (InetAddress address : Collections.list(network.getInetAddresses())) {
                if (address instanceof Inet4Address && address.isSiteLocalAddress() && !address.isLoopbackAddress()) return address;
            }
        }
        return null;
    }

    private String newToken() {
        final String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder code = new StringBuilder(8);
        for (int i = 0; i < 8; i++) code.append(alphabet.charAt(random.nextInt(alphabet.length())));
        return code.toString();
    }

    private void acceptViewers(ServerSocket current) {
        while (!current.isClosed()) {
            try {
                Socket socket = current.accept();
                workers.execute(() -> handleRequest(socket));
            } catch (IOException error) {
                if (!current.isClosed()) closeServer();
            }
        }
    }

    private void handleRequest(Socket socket) {
        boolean upgraded = false;
        try {
            socket.setSoTimeout(10000);
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.ISO_8859_1));
            String request = reader.readLine();
            if (request == null) return;
            String[] parts = request.split(" ");
            if (parts.length < 2 || !"GET".equals(parts[0])) { respond(socket, 405, "text/plain", "Method not allowed".getBytes(StandardCharsets.UTF_8)); return; }
            String path = parts[1].split("\\?", 2)[0];
            String webSocketKey = null;
            String line;
            while ((line = reader.readLine()) != null && !line.isEmpty()) {
                if (line.length() > 8192) return;
                if (line.toLowerCase(Locale.ROOT).startsWith("sec-websocket-key:")) webSocketKey = line.substring(18).trim();
            }
            if (path.equals("/live/" + token) && webSocketKey != null) {
                byte[] digest = MessageDigest.getInstance("SHA-1").digest((webSocketKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(StandardCharsets.ISO_8859_1));
                String accept = Base64.encodeToString(digest, Base64.NO_WRAP);
                socket.getOutputStream().write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
                socket.setSoTimeout(0);
                viewers.add(socket);
                upgraded = true;
                sendFrame(socket, snapshot);
                while (socket.getInputStream().read() != -1) { /* Only the phone can change the scoreboard. */ }
            } else if (path.equals("/tv/" + token)) {
                sendAsset(socket, "tv.html");
            } else if (path.equals("/state/" + token)) {
                respond(socket, 200, "application/json; charset=utf-8", snapshot.getBytes(StandardCharsets.UTF_8));
            } else if (path.startsWith("/assets/") || path.startsWith("/cards/")) {
                // URLDecoder treats '+' as a form-space, but modifier card files are named +2.webp, etc.
                String asset = URLDecoder.decode(path.substring(1).replace("+", "%2B"), StandardCharsets.UTF_8.name());
                if (asset.contains("..") || asset.contains("\\") || asset.startsWith("/")) respond(socket, 404, "text/plain", new byte[0]);
                else sendAsset(socket, asset);
            } else {
                respond(socket, 404, "text/plain", "TV session unavailable".getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception ignored) {
            // A TV disconnect or a cancelled request does not affect the game on the phone.
        } finally {
            if (upgraded) viewers.remove(socket);
            try { socket.close(); } catch (IOException ignored) {}
        }
    }

    private void sendAsset(Socket socket, String path) throws IOException {
        try (InputStream asset = getContext().getAssets().open("public/" + path); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192];
            int count;
            while ((count = asset.read(chunk)) != -1) buffer.write(chunk, 0, count);
            respond(socket, 200, mimeType(path), buffer.toByteArray());
        } catch (IOException error) {
            respond(socket, 404, "text/plain", "File unavailable".getBytes(StandardCharsets.UTF_8));
        }
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html; charset=utf-8";
        if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
        if (path.endsWith(".css")) return "text/css; charset=utf-8";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private static void respond(Socket socket, int status, String type, byte[] body) throws IOException {
        String label = status == 200 ? "OK" : status == 405 ? "Method Not Allowed" : "Not Found";
        OutputStream stream = socket.getOutputStream();
        stream.write(("HTTP/1.1 " + status + " " + label + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.length + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
        stream.write(body);
        stream.flush();
    }

    private static void sendFrame(Socket socket, String message) throws IOException {
        if (message == null) return;
        byte[] body = message.getBytes(StandardCharsets.UTF_8);
        synchronized (socket) {
            OutputStream stream = socket.getOutputStream();
            stream.write(0x81);
            if (body.length < 126) stream.write(body.length);
            else if (body.length <= 65535) { stream.write(126); stream.write(body.length >>> 8); stream.write(body.length); }
            else {
                stream.write(127);
                for (int shift = 56; shift >= 0; shift -= 8) stream.write((int) ((long) body.length >>> shift));
            }
            stream.write(body);
            stream.flush();
        }
    }

    private void broadcast() {
        String next = snapshot;
        for (Socket viewer : viewers) {
            try { sendFrame(viewer, next); }
            catch (IOException error) { viewers.remove(viewer); try { viewer.close(); } catch (IOException ignored) {} }
        }
    }

    private synchronized void closeServer() {
        if (server != null) try { server.close(); } catch (IOException ignored) {}
        for (Socket viewer : viewers) try { viewer.close(); } catch (IOException ignored) {}
        viewers.clear();
        server = null;
        roomId = null;
        token = null;
        snapshot = null;
        url = null;
    }
}

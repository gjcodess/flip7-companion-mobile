package com.gjcodess.flip7companion;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Handler;
import android.os.Looper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "LocalRoom")
public class LocalRoomPlugin extends Plugin {
    private static final int MAX_BODY = 16 * 1024;
    private final ExecutorService workers = Executors.newCachedThreadPool();
    private final SecureRandom random = new SecureRandom();
    private final Object changed = new Object();
    private final Map<String, JoinRequest> requests = new ConcurrentHashMap<>();
    private final Map<String, String> seatsBySecret = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<String>> actions = new ConcurrentHashMap<>();
    private volatile ServerSocket server;
    private volatile String roomId;
    private volatile String token;
    private volatile String joinUrl;
    private volatile String roomCode;
    private volatile String roomJson;
    private volatile long revision;
    private NsdManager nsdManager;
    private NsdManager.RegistrationListener registration;

    private static class JoinRequest {
        final String id;
        final String name;
        final String avatar;
        final String color;
        volatile String seatId = "";
        volatile String status = "pending";
        volatile String secret;

        JoinRequest(String id, JSONObject body) {
            this.id = id;
            this.name = body.optString("name", "").trim();
            this.avatar = body.optString("avatar", "");
            this.color = body.optString("color", "");
        }

        JSONObject json(boolean includeSecret) {
            JSONObject result = new JSONObject();
            try {
                result.put("id", id);
                result.put("name", name);
                result.put("avatar", avatar);
                result.put("color", color);
                result.put("seatId", seatId);
                result.put("status", status);
                if (includeSecret && secret != null) result.put("secret", secret);
            } catch (Exception ignored) {}
            return result;
        }
    }

    @PluginMethod
    public synchronized void start(PluginCall call) {
        String nextRoomId = call.getString("roomId");
        String nextRoomJson = call.getString("roomJson");
        if (nextRoomId == null || nextRoomJson == null) { call.reject("Choose a room to share."); return; }
        try {
            InetAddress address = findWifiAddress();
            if (address == null) { call.reject("Connect to Wi-Fi or turn on your hotspot first."); return; }
            if (server != null && !server.isClosed() && nextRoomId.equals(roomId) && joinUrl != null && joinUrl.startsWith("http://" + address.getHostAddress() + ":")) {
                setRoomJson(nextRoomJson);
            } else {
                closeServer();
                ServerSocket next = new ServerSocket(0, 24, address);
                server = next;
                roomId = nextRoomId;
                roomJson = nextRoomJson;
                revision = 1;
                token = newToken(16);
                roomCode = token.substring(0, 6);
                joinUrl = "http://" + address.getHostAddress() + ":" + next.getLocalPort() + "/join/" + token;
                advertiseRoom(next.getLocalPort());
                workers.execute(() -> acceptConnections(next));
            }
            JSObject result = new JSObject();
            result.put("roomId", roomId);
            result.put("joinUrl", joinUrl);
            result.put("code", roomCode);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not start local sharing: " + error.getMessage());
        }
    }

    @PluginMethod
    public synchronized void publish(PluginCall call) {
        String nextRoomJson = call.getString("roomJson");
        if (server == null || !call.getString("roomId", "").equals(roomId) || nextRoomJson == null) { call.reject("This room is not being shared."); return; }
        setRoomJson(nextRoomJson);
        call.resolve();
    }

    @PluginMethod
    public synchronized void stop(PluginCall call) { closeServer(); call.resolve(); }

    @PluginMethod
    public void listRequests(PluginCall call) {
        JSArray result = new JSArray();
        for (JoinRequest request : requests.values()) if (request.status.equals("pending")) result.put(request.json(false));
        JSObject response = new JSObject();
        response.put("requests", result);
        response.put("claimedSeats", claimedSeats());
        call.resolve(response);
    }

    @PluginMethod
    public synchronized void approve(PluginCall call) {
        JoinRequest request = requests.get(call.getString("requestId", ""));
        String seatId = call.getString("seatId", "");
        if (request == null || !request.status.equals("pending") || seatId.isEmpty()) { call.reject("This join request is no longer available."); return; }
        if (seatsBySecret.containsValue(seatId)) { call.reject("That seat is already controlled by another phone."); return; }
        request.seatId = seatId;
        request.secret = newToken(32);
        request.status = "approved";
        seatsBySecret.put(request.secret, seatId);
        signalChange();
        call.resolve();
    }

    @PluginMethod
    public void deny(PluginCall call) {
        JoinRequest request = requests.get(call.getString("requestId", ""));
        if (request == null || !request.status.equals("pending")) { call.reject("This join request is no longer available."); return; }
        request.status = "denied";
        signalChange();
        call.resolve();
    }

    @PluginMethod
    public void revoke(PluginCall call) {
        String seatId = call.getString("seatId", "");
        for (Map.Entry<String, String> entry : seatsBySecret.entrySet()) if (entry.getValue().equals(seatId)) seatsBySecret.remove(entry.getKey());
        signalChange();
        call.resolve();
    }

    @PluginMethod
    public void respondAction(PluginCall call) {
        CompletableFuture<String> waiting = actions.get(call.getString("actionId", ""));
        if (waiting != null) {
            JSONObject result = new JSONObject();
            try { result.put("ok", call.getBoolean("ok", false)); result.put("error", call.getString("error", "")); }
            catch (Exception ignored) {}
            waiting.complete(result.toString());
        }
        call.resolve();
    }

    // Native HTTP avoids WebView mixed-content restrictions when the installed app joins a LAN host.
    @PluginMethod
    public void request(PluginCall call) {
        String address = call.getString("url", "");
        String method = call.getString("method", "GET");
        String body = call.getString("body", "");
        workers.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(address);
                InetAddress host = InetAddress.getByName(url.getHost());
                if (!"http".equals(url.getProtocol()) || !(host instanceof Inet4Address) || !(host.isSiteLocalAddress() || host.isLoopbackAddress()) || url.getPort() < 1) throw new IOException("Use the host's local room address.");
                if (!"GET".equals(method) && !"POST".equals(method)) throw new IOException("Unsupported request.");
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod(method);
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(25000);
                connection.setUseCaches(false);
                if ("POST".equals(method)) {
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    try (OutputStream out = connection.getOutputStream()) { out.write(body.getBytes(StandardCharsets.UTF_8)); }
                }
                int status = connection.getResponseCode();
                InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                String response = input == null ? "" : new String(readAll(input, 12 * 1024 * 1024), StandardCharsets.UTF_8);
                JSObject result = new JSObject();
                result.put("status", status);
                result.put("body", response);
                call.resolve(result);
            } catch (Exception error) { call.reject(error.getMessage()); }
            finally { if (connection != null) connection.disconnect(); }
        });
    }

    @PluginMethod
    public void findCode(PluginCall call) {
        String code = call.getString("code", "").trim().toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z2-9]{6}")) { call.reject("Enter the six-character room code."); return; }
        NsdManager manager = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
        if (manager == null) { call.reject("Nearby-room discovery is unavailable on this device."); return; }
        final boolean[] done = { false };
        final NsdManager.DiscoveryListener[] holder = new NsdManager.DiscoveryListener[1];
        Runnable finish = () -> {
            if (done[0]) return;
            done[0] = true;
            try { manager.stopServiceDiscovery(holder[0]); } catch (Exception ignored) {}
        };
        holder[0] = new NsdManager.DiscoveryListener() {
            @Override public void onDiscoveryStarted(String type) {}
            @Override public void onDiscoveryStopped(String type) {}
            @Override public void onStartDiscoveryFailed(String type, int error) { finish.run(); call.reject("Could not search for nearby rooms."); }
            @Override public void onStopDiscoveryFailed(String type, int error) {}
            @Override public void onServiceLost(NsdServiceInfo info) {}
            @Override public void onServiceFound(NsdServiceInfo info) {
                if (done[0] || !info.getServiceName().startsWith("Flip7-" + code)) return;
                manager.resolveService(info, new NsdManager.ResolveListener() {
                    @Override public void onResolveFailed(NsdServiceInfo service, int error) {}
                    @Override public void onServiceResolved(NsdServiceInfo service) {
                        if (done[0]) return;
                        byte[] raw = service.getAttributes().get("invite");
                        InetAddress host = service.getHost();
                        if (raw == null || host == null || !(host instanceof Inet4Address)) return;
                        String resolvedToken = new String(raw, StandardCharsets.UTF_8);
                        if (!resolvedToken.matches("[A-Z2-9]{16}") || !resolvedToken.startsWith(code)) return;
                        JSObject result = new JSObject();
                        result.put("joinUrl", "http://" + host.getHostAddress() + ":" + service.getPort() + "/join/" + resolvedToken);
                        finish.run();
                        call.resolve(result);
                    }
                });
            }
        };
        try {
            manager.discoverServices("_flip7._tcp.", NsdManager.PROTOCOL_DNS_SD, holder[0]);
            new Handler(Looper.getMainLooper()).postDelayed(() -> { if (!done[0]) { finish.run(); call.reject("Room not found. Try the QR code or full address."); } }, 10000);
        } catch (Exception error) { finish.run(); call.reject("Nearby-room discovery failed. Try the QR code or full address."); }
    }

    @Override
    protected synchronized void handleOnDestroy() { closeServer(); workers.shutdownNow(); }

    private void setRoomJson(String next) {
        if (next.equals(roomJson)) return;
        roomJson = next;
        signalChange();
    }

    private void signalChange() {
        synchronized (changed) { revision++; changed.notifyAll(); }
        JSObject event = new JSObject(); event.put("revision", revision); notifyListeners("roomChanged", event);
    }

    private JSArray claimedSeats() {
        JSArray result = new JSArray();
        Set<String> unique = new HashSet<>(seatsBySecret.values());
        for (String seatId : unique) result.put(seatId);
        return result;
    }

    private void acceptConnections(ServerSocket current) {
        while (!current.isClosed()) {
            try { Socket socket = current.accept(); workers.execute(() -> handle(socket)); }
            catch (IOException error) { if (!current.isClosed()) closeServer(); }
        }
    }

    private void handle(Socket socket) {
        try (Socket client = socket) {
            client.setSoTimeout(30000);
            InputStream input = client.getInputStream();
            String first = readLine(input);
            if (first == null) return;
            String[] request = first.split(" ");
            if (request.length < 2) { respond(client, 400, "text/plain", "Bad request"); return; }
            String method = request[0];
            String path = request[1].split("\\?", 2)[0];
            int length = 0;
            for (String line; (line = readLine(input)) != null && !line.isEmpty();) {
                if (line.toLowerCase(Locale.ROOT).startsWith("content-length:")) length = Integer.parseInt(line.substring(15).trim());
            }
            if (length < 0 || length > MAX_BODY) { respond(client, 413, "text/plain", "Request too large"); return; }
            byte[] bodyBytes = new byte[length];
            int received = 0;
            while (received < length) {
                int count = input.read(bodyBytes, received, length - received);
                if (count < 0) throw new IOException("Request ended early");
                received += count;
            }
            String body = new String(bodyBytes, StandardCharsets.UTF_8);
            String activeToken = token;
            if (activeToken == null) { respond(client, 404, "text/plain", "Room closed"); return; }
            if (method.equals("GET") && path.equals("/join/" + activeToken)) { sendAsset(client, "index.html"); return; }
            if (method.equals("GET") && path.equals("/api/state/" + activeToken)) {
                long after = queryLong(request[1], "after");
                if (after >= revision) synchronized (changed) { if (after >= revision) changed.wait(20000); }
                JSONObject result = new JSONObject();
                long currentRevision = revision;
                result.put("revision", currentRevision);
                if (after < currentRevision) {
                    result.put("room", new JSONObject(roomJson));
                    result.put("claimedSeats", claimedSeats());
                }
                String credential = queryString(request[1], "key");
                if (!credential.isEmpty()) result.put("credentialValid", seatsBySecret.containsKey(credential));
                respond(client, 200, "application/json", result.toString());
                return;
            }
            if (method.equals("POST") && path.equals("/api/join/" + activeToken)) {
                JSONObject data = new JSONObject(body);
                JoinRequest join = new JoinRequest(newToken(24), data);
                if (join.name.isEmpty() || join.name.length() > 24 || requests.size() >= 50) { respond(client, 400, "application/json", "{\"error\":\"Set your name before asking to join.\"}"); return; }
                requests.put(join.id, join);
                JSObject event = new JSObject(); event.put("request", join.json(false)); notifyListeners("joinRequest", event);
                respond(client, 200, "application/json", join.json(false).toString());
                return;
            }
            if (method.equals("GET") && path.equals("/api/join-status/" + activeToken)) {
                JoinRequest join = requests.get(queryString(request[1], "request"));
                if (join == null) { respond(client, 404, "application/json", "{\"error\":\"Request expired.\"}"); return; }
                respond(client, 200, "application/json", join.json(true).toString());
                return;
            }
            if (method.equals("POST") && path.equals("/api/action/" + activeToken)) {
                JSONObject data = new JSONObject(body);
                String secret = data.optString("secret", "");
                String seatId = seatsBySecret.get(secret);
                String actionId = data.optString("actionId", "");
                if (seatId == null || actionId.length() < 16 || actionId.length() > 64) { respond(client, 403, "application/json", "{\"error\":\"Your seat is no longer connected. Rejoin the room.\"}"); return; }
                if (!data.has("action") || !(data.opt("action") instanceof JSONObject)) { respond(client, 400, "application/json", "{\"error\":\"Choose an action.\"}"); return; }
                CompletableFuture<String> pending = actions.computeIfAbsent(actionId, key -> {
                    CompletableFuture<String> future = new CompletableFuture<>();
                    JSObject event = new JSObject(); event.put("actionId", key); event.put("seatId", seatId); event.put("action", data.optJSONObject("action")); notifyListeners("guestAction", event);
                    return future;
                });
                try { respond(client, 200, "application/json", pending.get(12, TimeUnit.SECONDS)); }
                catch (Exception timeout) { respond(client, 503, "application/json", "{\"error\":\"Host did not answer. Check that their app is open.\"}"); }
                return;
            }
            if (method.equals("GET") && (path.startsWith("/assets/") || path.startsWith("/cards/") || path.equals("/manifest.webmanifest") || path.equals("/favicon.ico"))) {
                String asset = path.equals("/favicon.ico") ? "assets/flip7-companion-icon-512-rounded.png" : URLDecoder.decode(path.substring(1).replace("+", "%2B"), "UTF-8");
                if (asset.contains("..") || asset.contains("\\") || asset.startsWith("/")) respond(client, 404, "text/plain", "Not found");
                else sendAsset(client, asset);
                return;
            }
            respond(client, 404, "text/plain", "Room unavailable");
        } catch (Exception ignored) { /* A disconnected guest cannot affect the host's game. */ }
    }

    private static String queryString(String path, String key) throws Exception {
        int query = path.indexOf('?');
        if (query < 0) return "";
        for (String item : path.substring(query + 1).split("&")) {
            String[] pair = item.split("=", 2);
            if (pair.length == 2 && pair[0].equals(key)) return URLDecoder.decode(pair[1], "UTF-8");
        }
        return "";
    }

    private static long queryLong(String path, String key) {
        try { return Long.parseLong(queryString(path, key)); } catch (Exception ignored) { return 0; }
    }

    private static String readLine(InputStream input) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (int next; (next = input.read()) != -1;) {
            if (next == '\n') return out.toString("ISO-8859-1").replace("\r", "");
            if (out.size() >= 8192) throw new IOException("Header too large");
            out.write(next);
        }
        return out.size() == 0 ? null : out.toString("ISO-8859-1");
    }

    private static byte[] readAll(InputStream input, int max) throws IOException {
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192];
            int count;
            while ((count = in.read(chunk)) != -1) { if (out.size() + count > max) throw new IOException("Response too large"); out.write(chunk, 0, count); }
            return out.toByteArray();
        }
    }

    private void sendAsset(Socket socket, String path) throws IOException {
        try (InputStream asset = getContext().getAssets().open("public/" + path)) {
            byte[] bytes = readAll(asset, 4 * 1024 * 1024);
            String type = path.endsWith(".html") ? "text/html" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".webp") ? "image/webp" : path.endsWith(".png") ? "image/png" : path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".woff2") ? "font/woff2" : path.endsWith(".webmanifest") ? "application/manifest+json" : "application/octet-stream";
            respond(socket, 200, type, bytes);
        } catch (IOException error) { respond(socket, 404, "text/plain", "Asset unavailable"); }
    }

    private static void respond(Socket socket, int status, String type, String body) throws IOException { respond(socket, status, type, body.getBytes(StandardCharsets.UTF_8)); }
    private static void respond(Socket socket, int status, String type, byte[] body) throws IOException {
        String label = status == 200 ? "OK" : status == 400 ? "Bad Request" : status == 403 ? "Forbidden" : status == 413 ? "Payload Too Large" : status == 503 ? "Service Unavailable" : "Not Found";
        OutputStream out = socket.getOutputStream();
        out.write(("HTTP/1.1 " + status + " " + label + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.length + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
        out.write(body);
        out.flush();
    }

    private static InetAddress findWifiAddress() throws IOException {
        for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
            String name = network.getName().toLowerCase(Locale.ROOT);
            if (!network.isUp() || !(name.startsWith("wlan") || name.startsWith("ap") || name.startsWith("swlan"))) continue;
            for (InetAddress address : Collections.list(network.getInetAddresses())) if (address instanceof Inet4Address && address.isSiteLocalAddress() && !address.isLoopbackAddress()) return address;
        }
        return null;
    }

    private void advertiseRoom(int port) {
        try {
            nsdManager = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
            if (nsdManager == null) return;
            NsdServiceInfo info = new NsdServiceInfo();
            info.setServiceName("Flip7-" + roomCode);
            info.setServiceType("_flip7._tcp.");
            info.setPort(port);
            info.setAttribute("invite", token);
            registration = new NsdManager.RegistrationListener() {
                @Override public void onRegistrationFailed(NsdServiceInfo service, int error) {}
                @Override public void onUnregistrationFailed(NsdServiceInfo service, int error) {}
                @Override public void onServiceRegistered(NsdServiceInfo service) {}
                @Override public void onServiceUnregistered(NsdServiceInfo service) {}
            };
            nsdManager.registerService(info, NsdManager.PROTOCOL_DNS_SD, registration);
        } catch (Exception ignored) { registration = null; }
    }

    private String newToken(int length) {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder code = new StringBuilder(length);
        for (int i = 0; i < length; i++) code.append(alphabet.charAt(random.nextInt(alphabet.length())));
        return code.toString();
    }

    private synchronized void closeServer() {
        if (nsdManager != null && registration != null) try { nsdManager.unregisterService(registration); } catch (Exception ignored) {}
        registration = null; nsdManager = null;
        if (server != null) try { server.close(); } catch (IOException ignored) {}
        server = null; roomId = null; token = null; joinUrl = null; roomCode = null; roomJson = null; revision = 0;
        requests.clear(); seatsBySecret.clear(); actions.clear();
        synchronized (changed) { changed.notifyAll(); }
    }
}

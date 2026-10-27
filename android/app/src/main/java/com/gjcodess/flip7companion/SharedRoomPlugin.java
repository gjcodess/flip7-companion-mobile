package com.gjcodess.flip7companion;

import android.util.Base64;
import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.net.wifi.WifiManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;
import com.google.android.gms.tasks.Tasks;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.*;
import java.util.*;
import java.util.concurrent.*;
import java.nio.ByteBuffer;
import javax.crypto.*;
import javax.crypto.spec.*;

/** Native LAN transport. Game permissions and durable transactions live in the host engine.
 * Requests use the host public key pinned in the QR invitation, with a fresh AES-GCM key
 * for every exchange. A Wi-Fi peer cannot read hands or steal reconnect credentials.
 */
@CapacitorPlugin(name = "SharedRoom", permissions = {
    @Permission(alias = "nearbyCoarseLocation", strings = { Manifest.permission.ACCESS_COARSE_LOCATION }),
    @Permission(alias = "nearbyFineLocation", strings = { Manifest.permission.ACCESS_FINE_LOCATION }),
    @Permission(alias = "nearbyBluetooth", strings = { Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN }),
    @Permission(alias = "nearbyWifi", strings = { Manifest.permission.NEARBY_WIFI_DEVICES })
})
public class SharedRoomPlugin extends Plugin {
    private final ExecutorService workers = new ThreadPoolExecutor(24, 24, 30, TimeUnit.SECONDS, new ArrayBlockingQueue<>(64), new ThreadPoolExecutor.AbortPolicy());
    private final ConcurrentLinkedQueue<Incoming> inbox = new ConcurrentLinkedQueue<>();
    private final Map<String, Incoming> pending = new ConcurrentHashMap<>();
    private final Set<Socket> sockets = ConcurrentHashMap.newKeySet();
    private final SecureRandom random = new SecureRandom();
    private volatile ServerSocket server;
    private volatile DatagramSocket beacon;
    private volatile KeyPair keys;
    private volatile String hostedRoom;
    private volatile String roomCode;
    private volatile String invitationSecret;
    private volatile String address;
    private volatile ConnectionsClient nearby;
    private volatile String nearbyHostRoom;
    private volatile String nearbyHostCode;
    private volatile String nearbyClientEndpoint;
    private volatile String nearbyClientCode;
    private volatile String nearbyDiscoveryEndpoint;
    private volatile PluginCall nearbyResolveCall;
    private volatile PluginCall nearbyRequestCall;
    private volatile JSONObject nearbyExpectedInvitation;
    private final Map<String, CompletableFuture<JSONObject>> nearbyReplies = new ConcurrentHashMap<>();
    private final Map<String, PayloadAssembly> nearbyAssemblies = new ConcurrentHashMap<>();
    private final Map<String, Incoming> nearbyIncoming = new ConcurrentHashMap<>();
    private final Set<String> nearbyHostEndpoints = ConcurrentHashMap.newKeySet();
    private static final int SHARED_PROTOCOL = 2;
    private static final int DISCOVERY_PORT = 41777;
    private static final String NEARBY_SERVICE_ID = "com.gjcodess.flip7companion";
    private static final byte[] NEARBY_FRAME_MAGIC = new byte[] { 'F', '7', 'N', '1' };
    private static final int NEARBY_FRAME_HEADER = 28;
    private static final int NEARBY_CHUNK_BYTES = 24 * 1024;
    private static final int NEARBY_MAX_MESSAGE = 12 * 1024 * 1024;
    private static final int NEARBY_MAX_CHUNKS = (NEARBY_MAX_MESSAGE + NEARBY_CHUNK_BYTES - 1) / NEARBY_CHUNK_BYTES;
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int MAX_BODY = 12 * 1024 * 1024;
    private static class Incoming {
        final String id = UUID.randomUUID().toString();
        final JSONObject request;
        final CompletableFuture<String> reply = new CompletableFuture<>();
        final String nearbyEndpoint;
        final String nearbyRequestId;
        final byte[] nearbyKey;
        Incoming(JSONObject request) { this(request, null, null, null); }
        Incoming(JSONObject request, String endpoint, String requestId, byte[] key) { this.request = request; this.nearbyEndpoint = endpoint; this.nearbyRequestId = requestId; this.nearbyKey = key; }
    }
    private static class PayloadAssembly {
        final byte[][] chunks;
        int received;
        int bytes;
        final long createdAt = System.currentTimeMillis();
        PayloadAssembly(int count) { chunks = new byte[count][]; }
    }
    private static String b64(byte[] bytes) { return Base64.encodeToString(bytes, Base64.NO_WRAP); }
    private static byte[] un64(String value) { return Base64.decode(value, Base64.DEFAULT); }
    private byte[] bytes(int count) { byte[] value = new byte[count]; random.nextBytes(value); return value; }
    private String newRoomCode() {
        StringBuilder out = new StringBuilder(6);
        for (int i = 0; i < 6; i++) out.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
        return out.toString();
    }
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
                    stopNearbyState();
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
                                String savedCode = prefs.getString("code", "");
                                roomCode = savedCode.matches("[A-Z0-9]{6}") ? savedCode : newRoomCode();
                                port = prefs.getInt("port", 0);
                            } catch (Exception ignored) { keys = null; }
                        }
                        if (keys == null) {
                            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(2048); keys = generator.generateKeyPair();
                            invitationSecret = b64(bytes(32));
                            roomCode = newRoomCode();
                        }
                        ServerSocket listener = new ServerSocket(); listener.setReuseAddress(true);
                        try { listener.bind(new InetSocketAddress(lan, port), 24); }
                        catch (IOException occupied) { listener.close(); listener = new ServerSocket(0, 24, lan); }
                        server = listener; address = lan.getHostAddress(); hostedRoom = room;
                        prefs.edit().putString("room", room).putString("public", b64(keys.getPublic().getEncoded())).putString("private", b64(keys.getPrivate().getEncoded())).putString("secret", invitationSecret).putString("code", roomCode).putInt("port", server.getLocalPort()).apply();
                        final ServerSocket active = server;
                        Thread accept = new Thread(() -> accept(active), "flip7-room-listener"); accept.setDaemon(true); accept.start();
                        try {
                            DatagramSocket udp = new DatagramSocket(null);
                            udp.setReuseAddress(true);
                            udp.bind(new InetSocketAddress(DISCOVERY_PORT));
                            beacon = udp;
                            Thread discover = new Thread(() -> listenDiscovery(udp), "flip7-room-beacon");
                            discover.setDaemon(true);
                            discover.start();
                        } catch (IOException ignored) { /* QR still works if discovery port is busy */ }
                    }
                    JSObject result = currentInvitation();
                    getActivity().runOnUiThread(() -> getActivity().getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON));
                    call.resolve(result);
                } catch (Exception error) { closeServer(); call.reject("Could not host: " + error.getMessage()); }
            }
        });
    }

    @PluginMethod
    public void startNearby(PluginCall call) {
        if (!requestNearbyPermissions(call, "startNearbyPermissionResult")) return;
        beginNearbyHosting(call);
    }

    @PermissionCallback
    private void startNearbyPermissionResult(PluginCall call) {
        if (!nearbyPermissionsGranted()) { call.reject("Nearby play needs the requested Bluetooth and Wi-Fi permissions. You can still use the same Wi-Fi or hotspot option."); return; }
        beginNearbyHosting(call);
    }

    @PluginMethod
    public void resolveNearbyCode(PluginCall call) {
        if (!requestNearbyPermissions(call, "resolveNearbyPermissionResult")) return;
        beginNearbySearch(call);
    }

    @PermissionCallback
    private void resolveNearbyPermissionResult(PluginCall call) {
        if (!nearbyPermissionsGranted()) { call.reject("Nearby play needs the requested Bluetooth and Wi-Fi permissions. You can still join on the same Wi-Fi or hotspot."); return; }
        beginNearbySearch(call);
    }

    private boolean requestNearbyPermissions(PluginCall call, String callback) {
        List<String> aliases = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31) aliases.add("nearbyBluetooth");
        if (Build.VERSION.SDK_INT >= 32) aliases.add("nearbyWifi");
        else if (Build.VERSION.SDK_INT <= 30) aliases.add(Build.VERSION.SDK_INT <= 28 ? "nearbyCoarseLocation" : "nearbyFineLocation");
        if (nearbyPermissionsGranted()) return true;
        requestPermissionForAliases(aliases.toArray(new String[0]), call, callback);
        return false;
    }

    private boolean nearbyPermissionsGranted() {
        if (Build.VERSION.SDK_INT <= 30) {
            String location = Build.VERSION.SDK_INT <= 28 ? Manifest.permission.ACCESS_COARSE_LOCATION : Manifest.permission.ACCESS_FINE_LOCATION;
            if (!hasPermission(location)) return false;
        }
        if (Build.VERSION.SDK_INT >= 31 && (
            !hasPermission(Manifest.permission.BLUETOOTH_ADVERTISE) ||
            !hasPermission(Manifest.permission.BLUETOOTH_CONNECT) ||
            !hasPermission(Manifest.permission.BLUETOOTH_SCAN))) return false;
        return Build.VERSION.SDK_INT < 32 || hasPermission(Manifest.permission.NEARBY_WIFI_DEVICES);
    }

    private void requireNearbyRadios() throws IOException {
        WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        BluetoothAdapter bluetooth = BluetoothAdapter.getDefaultAdapter();
        if (wifi == null || !wifi.isWifiEnabled() || bluetooth == null || !bluetooth.isEnabled()) {
            throw new IOException("Turn on Wi-Fi and Bluetooth on both phones for Nearby play. No hotspot or mobile data is needed. You can switch to the same Wi-Fi or hotspot option instead.");
        }
    }

    private ConnectionsClient nearbyClient() {
        ConnectionsClient current = nearby;
        if (current == null) {
            if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext()) != com.google.android.gms.common.ConnectionResult.SUCCESS) throw new IllegalStateException("Nearby play needs Google Play services on this Android device. Use the same Wi-Fi or hotspot option instead.");
            current = Nearby.getConnectionsClient(getContext()); nearby = current;
        }
        return current;
    }

    private void beginNearbyHosting(PluginCall call) {
        workers.execute(() -> {
            try {
                String room = call.getString("roomId");
                if (room == null || !room.matches("[a-zA-Z0-9-]{1,80}")) throw new IOException("Invalid room.");
                requireNearbyRadios();
                synchronized (this) { closeServer(); }
                stopNearbyState();
                ensureNearbyHostCredentials(room);
                ConnectionsClient client = nearbyClient();
                client.stopAdvertising();
                String code = nearbyHostCode;
                byte[] info = new JSONObject().put("code", code).put("protocol", SHARED_PROTOCOL).toString().getBytes(StandardCharsets.UTF_8);
                client.startAdvertising(info, NEARBY_SERVICE_ID, nearbyHostLifecycle, new AdvertisingOptions.Builder().setStrategy(Strategy.P2P_STAR).build())
                    .addOnSuccessListener(ignored -> {
                        nearbyHostRoom = room;
                        getActivity().runOnUiThread(() -> getActivity().getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON));
                        JSObject result = new JSObject(); result.put("publicKey", b64(keys.getPublic().getEncoded())); result.put("invitationSecret", invitationSecret); result.put("code", code);
                        call.resolve(result);
                    })
                    .addOnFailureListener(error -> call.reject("Could not start Nearby play. Turn on Wi-Fi and Bluetooth, or use the same Wi-Fi/hotspot option. " + error.getMessage()));
            } catch (Exception error) { call.reject(error.getMessage() == null ? "Could not start Nearby play." : error.getMessage()); }
        });
    }

    private void ensureNearbyHostCredentials(String room) throws Exception {
        synchronized (this) {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("shared-room-host", 0);
            boolean reused = false;
            if (room.equals(prefs.getString("room", ""))) {
                try {
                    KeyFactory factory = KeyFactory.getInstance("RSA");
                    keys = new KeyPair(factory.generatePublic(new X509EncodedKeySpec(un64(prefs.getString("public", "")))), factory.generatePrivate(new PKCS8EncodedKeySpec(un64(prefs.getString("private", "")))));
                    invitationSecret = prefs.getString("secret", "");
                    String savedCode = prefs.getString("code", "");
                    if (invitationSecret.matches("[A-Za-z0-9+/=]{40,100}") && savedCode.matches("[A-Z0-9]{6}")) { nearbyHostCode = savedCode; reused = true; }
                } catch (Exception ignored) { keys = null; }
            }
            if (!reused) {
                KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(2048); keys = generator.generateKeyPair();
                invitationSecret = b64(bytes(32)); nearbyHostCode = newRoomCode();
            }
            prefs.edit().putString("room", room).putString("public", b64(keys.getPublic().getEncoded())).putString("private", b64(keys.getPrivate().getEncoded())).putString("secret", invitationSecret).putString("code", nearbyHostCode).apply();
            nearbyHostRoom = room;
        }
    }

    private void beginNearbySearch(PluginCall call) {
        String code = call.getString("code", "").trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (!code.matches("[A-Z0-9]{6}")) { call.reject("Enter the 6-character room code."); return; }
        try { requireNearbyRadios(); }
        catch (Exception error) { call.reject(error.getMessage()); return; }
        if (code.equals(nearbyClientCode) && nearbyClientEndpoint != null) {
            if (nearbyClientInvitation == null) { call.reject("The nearby room is still connecting. Please wait a moment."); return; }
            JSObject invite = currentNearbyInvitation(); call.resolve(invite); return;
        }
        synchronized (this) {
            if (nearbyResolveCall != null || nearbyRequestCall != null) { call.reject("A nearby connection is already being started. Please wait a moment."); return; }
            nearbyResolveCall = call; nearbyClientCode = code;
        }
        ConnectionsClient client;
        try { client = nearbyClient(); }
        catch (Exception error) { failNearbyJoin(error.getMessage() == null ? "Nearby play is unavailable on this device. Use the same Wi-Fi or hotspot option instead." : error.getMessage()); return; }
        client.startDiscovery(NEARBY_SERVICE_ID, nearbyEndpointDiscovery, new DiscoveryOptions.Builder().setStrategy(Strategy.P2P_STAR).build())
            .addOnFailureListener(error -> failNearbyJoin("Could not search for nearby rooms. Turn on Wi-Fi and Bluetooth, or switch to the same Wi-Fi/hotspot option."));
        workers.execute(() -> {
            try { Thread.sleep(18000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            if (nearbyResolveCall == call) failNearbyJoin("No nearby room found for that code. Keep the host room open, check that both phones have Wi-Fi and Bluetooth on, or use the same Wi-Fi/hotspot option.");
        });
    }

    private void failNearbyJoin(String message) {
        PluginCall resolve = nearbyResolveCall; nearbyResolveCall = null;
        PluginCall request = nearbyRequestCall; nearbyRequestCall = null;
        nearbyExpectedInvitation = null; nearbyDiscoveryEndpoint = null;
        ConnectionsClient client = nearby;
        if (client != null) client.stopDiscovery();
        if (resolve != null) resolve.reject(message);
        if (request != null) request.reject(message);
    }

    private JSObject currentNearbyInvitation() {
        try { return nearbyClientInvitation == null ? new JSObject() : JSObject.fromJSONObject(nearbyClientInvitation); }
        catch (Exception ignored) { return new JSObject(); }
    }
    private volatile JSONObject nearbyClientInvitation;

    private final PayloadCallback nearbyPayloadCallback = new PayloadCallback() {
        @Override public void onPayloadReceived(String endpointId, Payload payload) {
            if (payload.getType() != Payload.Type.BYTES) return;
            byte[] complete = acceptNearbyFrame(endpointId, payload.asBytes());
            if (complete != null) onNearbyMessage(endpointId, complete);
        }
        @Override public void onPayloadTransferUpdate(String endpointId, PayloadTransferUpdate update) {}
    };

    private final ConnectionLifecycleCallback nearbyHostLifecycle = new ConnectionLifecycleCallback() {
        @Override public void onConnectionInitiated(String endpointId, com.google.android.gms.nearby.connection.ConnectionInfo info) {
            if (nearbyHostRoom == null || !("FLIP7:" + nearbyHostCode).equals(info.getEndpointName())) { nearbyClient().rejectConnection(endpointId); return; }
            nearbyClient().acceptConnection(endpointId, nearbyPayloadCallback);
        }
        @Override public void onConnectionResult(String endpointId, ConnectionResolution resolution) {
            if (resolution.getStatus().isSuccess() && nearbyHostRoom != null) {
                // Bound the number of nearby peers to a full Flip 7 table and only
                // accept requests from endpoints that completed this handshake.
                synchronized (nearbyHostEndpoints) {
                    if (nearbyHostEndpoints.size() >= 18) { nearbyClient().disconnectFromEndpoint(endpointId); return; }
                    nearbyHostEndpoints.add(endpointId);
                }
                workers.execute(() -> sendNearbyInvitation(endpointId));
            } else nearbyClient().disconnectFromEndpoint(endpointId);
        }
        @Override public void onDisconnected(String endpointId) { nearbyHostEndpoints.remove(endpointId); clearNearbyAssemblies(endpointId); }
    };

    private final ConnectionLifecycleCallback nearbyClientLifecycle = new ConnectionLifecycleCallback() {
        @Override public void onConnectionInitiated(String endpointId, com.google.android.gms.nearby.connection.ConnectionInfo info) { nearbyClient().acceptConnection(endpointId, nearbyPayloadCallback); }
        @Override public void onConnectionResult(String endpointId, ConnectionResolution resolution) {
            if (resolution.getStatus().isSuccess()) {
                nearbyClientEndpoint = endpointId; nearbyDiscoveryEndpoint = null; nearbyClient().stopDiscovery();
            } else failNearbyJoin("Could not connect to that nearby room. Keep both phones close, check Wi-Fi and Bluetooth, or use the same Wi-Fi/hotspot option.");
        }
        @Override public void onDisconnected(String endpointId) {
            if (endpointId.equals(nearbyClientEndpoint)) nearbyClientEndpoint = null;
            clearNearbyAssemblies(endpointId);
            for (Map.Entry<String, CompletableFuture<JSONObject>> entry : nearbyReplies.entrySet()) if (entry.getValue().completeExceptionally(new IOException("Nearby connection lost. Reconnect to continue."))) nearbyRequestKeys.remove(entry.getKey());
        }
    };

    private final EndpointDiscoveryCallback nearbyEndpointDiscovery = new EndpointDiscoveryCallback() {
        @Override public void onEndpointFound(String endpointId, DiscoveredEndpointInfo info) {
            String expected = nearbyClientCode;
            if (expected == null || !expected.equalsIgnoreCase(readNearbyCode(info.getEndpointInfo()))) return;
            synchronized (SharedRoomPlugin.this) {
                if (nearbyDiscoveryEndpoint != null || nearbyClientEndpoint != null) return;
                nearbyDiscoveryEndpoint = endpointId;
            }
            nearbyClient().stopDiscovery();
            nearbyClient().requestConnection("FLIP7:" + expected, endpointId, nearbyClientLifecycle)
                .addOnFailureListener(error -> failNearbyJoin("Could not request the nearby connection. Check Wi-Fi and Bluetooth, or use the same Wi-Fi/hotspot option."));
        }
        @Override public void onEndpointLost(String endpointId) { if (endpointId.equals(nearbyDiscoveryEndpoint)) nearbyDiscoveryEndpoint = null; }
    };

    private static String readNearbyCode(byte[] bytes) {
        try { return new JSONObject(new String(bytes, StandardCharsets.UTF_8)).optString("code", "").toUpperCase(Locale.ROOT); }
        catch (Exception ignored) { return ""; }
    }

    private void sendNearbyInvitation(String endpointId) {
        try {
            if (keys == null || nearbyHostRoom == null || nearbyHostCode == null) throw new IOException("The host invitation is no longer available.");
            JSONObject invite = new JSONObject().put("kind", "invitation").put("protocol", SHARED_PROTOCOL).put("roomId", nearbyHostRoom).put("transport", "nearby").put("code", nearbyHostCode).put("publicKey", b64(keys.getPublic().getEncoded())).put("invitationSecret", invitationSecret);
            sendNearbyMessage(endpointId, invite.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) { nearbyClient().disconnectFromEndpoint(endpointId); }
    }

    private void onNearbyMessage(String endpointId, byte[] bytes) {
        try {
            JSONObject envelope = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
            String kind = envelope.optString("kind", "");
            if ("invitation".equals(kind) && endpointId.equals(nearbyClientEndpoint)) {
                JSONObject invite = new JSONObject(envelope.toString()); invite.remove("kind");
                if (invite.optInt("protocol") != SHARED_PROTOCOL || !"nearby".equals(invite.optString("transport")) || !nearbyClientCode.equalsIgnoreCase(invite.optString("code"))) throw new IOException("The nearby room invitation is invalid.");
                if (nearbyExpectedInvitation != null && (!nearbyExpectedInvitation.optString("roomId").equals(invite.optString("roomId")) || !nearbyExpectedInvitation.optString("publicKey").equals(invite.optString("publicKey")) || !nearbyExpectedInvitation.optString("invitationSecret").equals(invite.optString("invitationSecret")))) throw new IOException("This is not the host from your saved room. Check the room code.");
                nearbyClientInvitation = invite;
                PluginCall resolve = nearbyResolveCall; nearbyResolveCall = null;
                if (resolve != null) resolve.resolve(JSObject.fromJSONObject(invite));
                PluginCall request = nearbyRequestCall; nearbyRequestCall = null;
                if (request != null) workers.execute(() -> sendNearbyRequest(request));
                return;
            }
            if ("response".equals(kind)) {
                if (!endpointId.equals(nearbyClientEndpoint)) return;
                String id = envelope.getString("id"); CompletableFuture<JSONObject> response = nearbyReplies.remove(id); byte[] key = nearbyRequestKeys.remove(id);
                if (response != null && key != null) response.complete(new JSONObject(open(key, envelope.getJSONObject("sealed"))));
                return;
            }
            if (!"request".equals(kind) || !nearbyHostEndpoints.contains(endpointId) || keys == null || invitationSecret == null) return;
            String id = envelope.getString("id"); JSONObject sealed = envelope.getJSONObject("sealed");
            byte[] key = rsa(Cipher.DECRYPT_MODE, keys.getPrivate()).doFinal(un64(sealed.getString("key")));
            JSONObject request = new JSONObject(open(key, sealed));
            if (!MessageDigest.isEqual(invitationSecret.getBytes(StandardCharsets.UTF_8), request.optString("invitationSecret").getBytes(StandardCharsets.UTF_8))) return;
            request.remove("invitationSecret");
            if (pending.size() >= 48) throw new IOException("Host busy");
            Incoming incoming = new Incoming(request, endpointId, id, key); pending.put(incoming.id, incoming); nearbyIncoming.put(incoming.id, incoming); inbox.add(incoming);
        } catch (Exception ignored) { /* Invalid or incomplete peer data cannot change a room. */ }
    }

    private final Map<String, byte[]> nearbyRequestKeys = new ConcurrentHashMap<>();

    private void sendNearbyRequest(PluginCall call) {
        String id = UUID.randomUUID().toString(); byte[] key = bytes(32);
        CompletableFuture<JSONObject> reply = new CompletableFuture<>(); nearbyReplies.put(id, reply); nearbyRequestKeys.put(id, key);
        try {
            JSONObject request = new JSONObject(call.getObject("request", new JSObject()).toString()); request.put("invitationSecret", call.getString("invitationSecret", ""));
            JSONObject sealed = seal(key, request.toString()).put("key", b64(rsa(Cipher.ENCRYPT_MODE, KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(un64(call.getString("publicKey", ""))))).doFinal(key)));
            JSONObject envelope = new JSONObject().put("kind", "request").put("id", id).put("sealed", sealed);
            sendNearbyMessage(nearbyClientEndpoint, envelope.toString().getBytes(StandardCharsets.UTF_8));
            JSONObject response = reply.get(8, TimeUnit.SECONDS); call.resolve(JSObject.fromJSONObject(response));
        } catch (Exception error) { call.reject("Nearby connection paused. Keep the host room open and check Wi-Fi and Bluetooth. " + (error.getMessage() == null ? "" : error.getMessage())); }
        finally { nearbyReplies.remove(id); nearbyRequestKeys.remove(id); }
    }

    private void sendNearbyMessage(String endpointId, byte[] message) throws Exception {
        if (message.length > NEARBY_MAX_MESSAGE) throw new IOException("The room update is too large to send nearby.");
        ConnectionsClient client = nearbyClient(); String transferId = UUID.randomUUID().toString().replace("-", "");
        byte[] transfer = new byte[16]; for (int i = 0; i < transfer.length; i++) transfer[i] = (byte) Integer.parseInt(transferId.substring(i * 2, i * 2 + 2), 16);
        int total = Math.max(1, (message.length + NEARBY_CHUNK_BYTES - 1) / NEARBY_CHUNK_BYTES);
        if (total > NEARBY_MAX_CHUNKS) throw new IOException("The room update is too large to send nearby.");
        for (int index = 0; index < total; index++) {
            int start = index * NEARBY_CHUNK_BYTES, length = Math.min(NEARBY_CHUNK_BYTES, message.length - start);
            ByteBuffer frame = ByteBuffer.allocate(NEARBY_FRAME_HEADER + length); frame.put(NEARBY_FRAME_MAGIC).put(transfer).putInt(index).putInt(total).put(message, start, length);
            Tasks.await(client.sendPayload(endpointId, Payload.fromBytes(frame.array())), 8, TimeUnit.SECONDS);
        }
    }

    private byte[] acceptNearbyFrame(String endpointId, byte[] frame) {
        if (frame == null || frame.length < NEARBY_FRAME_HEADER || frame.length > NEARBY_FRAME_HEADER + NEARBY_CHUNK_BYTES) return null;
        try {
            ByteBuffer input = ByteBuffer.wrap(frame);
            for (byte expected : NEARBY_FRAME_MAGIC) if (input.get() != expected) return null;
            byte[] idBytes = new byte[16]; input.get(idBytes); StringBuilder id = new StringBuilder(32); for (byte b : idBytes) id.append(String.format(Locale.ROOT, "%02x", b & 0xff));
            int index = input.getInt(), total = input.getInt(), length = input.remaining();
            if (total < 1 || total > NEARBY_MAX_CHUNKS || index < 0 || index >= total || length < 0 || length > NEARBY_CHUNK_BYTES) return null;
            String key = endpointId + ":" + id;
            nearbyAssemblies.entrySet().removeIf(entry -> System.currentTimeMillis() - entry.getValue().createdAt > 30000);
            if (nearbyAssemblies.size() >= 32 && !nearbyAssemblies.containsKey(key)) return null;
            PayloadAssembly assembly = nearbyAssemblies.computeIfAbsent(key, ignored -> new PayloadAssembly(total));
            if (assembly.chunks.length != total || assembly.chunks[index] != null || assembly.bytes + length > NEARBY_MAX_MESSAGE) return null;
            byte[] chunk = new byte[length]; input.get(chunk); assembly.chunks[index] = chunk; assembly.bytes += length; assembly.received++;
            if (assembly.received != total) return null;
            nearbyAssemblies.remove(key); ByteArrayOutputStream output = new ByteArrayOutputStream(assembly.bytes); for (byte[] part : assembly.chunks) { if (part == null) return null; output.write(part); } return output.toByteArray();
        } catch (Exception ignored) { return null; }
    }

    private void clearNearbyAssemblies(String endpointId) { nearbyAssemblies.keySet().removeIf(key -> key.startsWith(endpointId + ":")); }

    private void beginNearbyDiscovery(String code) {
        try {
            ConnectionsClient client = nearbyClient();
            client.startDiscovery(NEARBY_SERVICE_ID, nearbyEndpointDiscovery, new DiscoveryOptions.Builder().setStrategy(Strategy.P2P_STAR).build())
                .addOnFailureListener(error -> failNearbyJoin("Could not search for nearby rooms. Turn on Wi-Fi and Bluetooth, or switch to the same Wi-Fi/hotspot option."));
        } catch (Exception error) { failNearbyJoin("Nearby play is unavailable on this device. You can still use the same Wi-Fi or hotspot option."); }
    }

    private boolean requestNearby(PluginCall call) {
        String mode = call.getString("transport", "wifi");
        if (!"nearby".equals(mode)) return false;
        String code = call.getString("code", "").trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (!code.matches("[A-Z0-9]{6}")) { call.reject("Reconnect to the nearby room using its 6-character code."); return true; }
        if (!nearbyPermissionsGranted()) { call.reject("Nearby permissions are off. Turn them on to reconnect, or use the same Wi-Fi/hotspot option."); return true; }
        try { requireNearbyRadios(); } catch (Exception error) { call.reject(error.getMessage()); return true; }
        JSONObject expected;
        try { expected = new JSONObject(call.getData().toString()); }
        catch (Exception error) { call.reject("Invalid nearby room invitation."); return true; }
        if (nearbyClientEndpoint != null && code.equalsIgnoreCase(nearbyClientCode) && nearbyClientInvitation != null) {
            if (!sameNearbyInvitation(expected, nearbyClientInvitation)) { call.reject("This is not the host from your saved room. Check the room code."); return true; }
            workers.execute(() -> sendNearbyRequest(call)); return true;
        }
        synchronized (this) {
            if (nearbyResolveCall != null || nearbyRequestCall != null) { call.reject("A nearby connection is already being started. Please wait a moment."); return true; }
            nearbyRequestCall = call; nearbyExpectedInvitation = expected; nearbyClientCode = code;
        }
        beginNearbyDiscovery(code);
        workers.execute(() -> {
            try { Thread.sleep(18000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            if (nearbyRequestCall == call) failNearbyJoin("Could not reconnect nearby. Keep the host room open, check Wi-Fi and Bluetooth, or switch to the same Wi-Fi/hotspot option.");
        });
        return true;
    }

    private boolean sameNearbyInvitation(JSONObject expected, JSONObject actual) {
        return expected != null && expected.optString("roomId").equals(actual.optString("roomId")) && expected.optString("publicKey").equals(actual.optString("publicKey")) && expected.optString("invitationSecret").equals(actual.optString("invitationSecret"));
    }
    private JSObject currentInvitation() {
        JSObject result = new JSObject();
        result.put("url", "http://" + address + ":" + server.getLocalPort() + "/room/" + hostedRoom);
        result.put("publicKey", b64(keys.getPublic().getEncoded()));
        result.put("invitationSecret", invitationSecret);
        result.put("code", roomCode);
        return result;
    }
    private void listenDiscovery(DatagramSocket udp) {
        byte[] buffer = new byte[512];
        while (!udp.isClosed()) {
            try {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                udp.receive(packet);
                String query = new String(packet.getData(), packet.getOffset(), packet.getLength(), StandardCharsets.UTF_8).trim();
                String code = roomCode;
                ServerSocket active = server;
                KeyPair pair = keys;
                if (code != null && active != null && !active.isClosed() && pair != null && query.equalsIgnoreCase("FLIP7_FIND:" + code)) {
                    JSONObject payload = new JSONObject()
                        .put("protocol", SHARED_PROTOCOL)
                        .put("roomId", hostedRoom)
                        .put("code", code)
                        .put("url", "http://" + address + ":" + active.getLocalPort() + "/room/" + hostedRoom)
                        .put("publicKey", b64(pair.getPublic().getEncoded()))
                        .put("invitationSecret", invitationSecret);
                    byte[] response = payload.toString().getBytes(StandardCharsets.UTF_8);
                    udp.send(new DatagramPacket(response, response.length, packet.getAddress(), packet.getPort()));
                }
            } catch (Exception ignored) {
                if (udp.isClosed()) break;
            }
        }
    }
    @PluginMethod
    public void resolveCode(PluginCall call) {
        workers.execute(() -> {
            String raw = call.getString("code", "").trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
            if (!raw.matches("[A-Z0-9]{6}")) { call.reject("Enter a 6-character room code."); return; }
            if (server != null && !server.isClosed() && raw.equalsIgnoreCase(roomCode)) {
                JSObject own = currentInvitation();
                own.put("protocol", SHARED_PROTOCOL);
                own.put("roomId", hostedRoom);
                call.resolve(own);
                return;
            }
            try (DatagramSocket socket = new DatagramSocket()) {
                socket.setBroadcast(true);
                socket.setSoTimeout(750);
                byte[] probe = ("FLIP7_FIND:" + raw).getBytes(StandardCharsets.UTF_8);
                Set<InetAddress> targets = broadcastTargets();
                byte[] buffer = new byte[4096];
                for (int attempt = 0; attempt < 3; attempt++) {
                    for (InetAddress target : targets) {
                        try { socket.send(new DatagramPacket(probe, probe.length, target, DISCOVERY_PORT)); }
                        catch (IOException ignored) {}
                    }
                    long deadline = System.currentTimeMillis() + 750;
                    while (System.currentTimeMillis() < deadline) {
                        try {
                            DatagramPacket reply = new DatagramPacket(buffer, buffer.length);
                            socket.receive(reply);
                            JSONObject json = new JSONObject(new String(reply.getData(), reply.getOffset(), reply.getLength(), StandardCharsets.UTF_8));
                            if (raw.equalsIgnoreCase(json.optString("code"))) {
                                call.resolve(JSObject.fromJSONObject(json));
                                return;
                            }
                        } catch (SocketTimeoutException timeout) { break; }
                    }
                }
                call.reject("Room not found. Check the 6-character code and make sure both phones are on the same Wi-Fi or hotspot.");
            } catch (Exception error) {
                call.reject("Could not search for room on your network. Check Wi-Fi or scan the QR code.");
            }
        });
    }
    private static Set<InetAddress> broadcastTargets() {
        Set<InetAddress> targets = new LinkedHashSet<>();
        try { targets.add(InetAddress.getByName("255.255.255.255")); } catch (Exception ignored) {}
        try {
            for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!network.isUp() || network.isLoopback()) continue;
                for (InterfaceAddress ia : network.getInterfaceAddresses()) {
                    InetAddress broadcast = ia.getBroadcast();
                    if (broadcast instanceof Inet4Address) targets.add(broadcast);
                }
            }
        } catch (Exception ignored) {}
        return targets;
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
        if (incoming != null && incoming.nearbyEndpoint != null) {
            pending.remove(incoming.id); nearbyIncoming.remove(incoming.id);
            String responseText = call.getObject("response", new JSObject()).toString();
            workers.execute(() -> {
                try {
                    JSONObject sealed = seal(incoming.nearbyKey, responseText);
                    JSONObject envelope = new JSONObject().put("kind", "response").put("id", incoming.nearbyRequestId).put("sealed", sealed);
                    sendNearbyMessage(incoming.nearbyEndpoint, envelope.toString().getBytes(StandardCharsets.UTF_8)); call.resolve();
                } catch (Exception error) { call.reject("Could not send the nearby reply. The player may need to reconnect."); }
            });
            return;
        }
        if (incoming != null) incoming.reply.complete(call.getObject("response", new JSObject()).toString());
        call.resolve();
    }
    @PluginMethod
    public void stop(PluginCall call) { synchronized (this) { closeServer(); } stopNearbyState(); call.resolve(); }

    @PluginMethod
    public void request(PluginCall call) {
        if (requestNearby(call)) return;
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
        if (beacon != null) { beacon.close(); beacon = null; }
        if (server != null) try { server.close(); } catch (IOException ignored) {}
        for (Socket socket : sockets) try { socket.close(); } catch (IOException ignored) {}
        for (Incoming request : pending.values()) request.reply.complete("{\"ok\":false,\"error\":\"Hosting stopped.\"}");
        sockets.clear(); pending.clear(); inbox.clear(); server = null; keys = null; hostedRoom = null; roomCode = null; address = null;
        if (getActivity() != null) getActivity().runOnUiThread(() -> getActivity().getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON));
    }
    private synchronized void stopNearbyState() {
        ConnectionsClient client = nearby;
        if (client != null) { client.stopAdvertising(); client.stopDiscovery(); client.stopAllEndpoints(); }
        nearbyHostRoom = null; nearbyHostCode = null; nearbyHostEndpoints.clear(); nearbyClientEndpoint = null; nearbyClientCode = null; nearbyDiscoveryEndpoint = null; nearbyClientInvitation = null; nearbyExpectedInvitation = null;
        PluginCall resolve = nearbyResolveCall; nearbyResolveCall = null;
        PluginCall request = nearbyRequestCall; nearbyRequestCall = null;
        if (resolve != null) resolve.reject("Nearby room sharing stopped.");
        if (request != null) request.reject("Nearby room sharing stopped.");
        for (CompletableFuture<JSONObject> pendingReply : nearbyReplies.values()) pendingReply.completeExceptionally(new IOException("Nearby room sharing stopped."));
        nearbyReplies.clear(); nearbyRequestKeys.clear(); nearbyAssemblies.clear();
        for (Incoming incoming : nearbyIncoming.values()) { pending.remove(incoming.id); inbox.remove(incoming); }
        nearbyIncoming.clear();
        if (getActivity() != null) getActivity().runOnUiThread(() -> getActivity().getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON));
    }
    @Override protected void handleOnDestroy() { closeServer(); stopNearbyState(); workers.shutdownNow(); }
}

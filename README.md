# NERV Auxiliary Terminal

Tablet-first NERV Deck and a separately deployable desktop LOQ Link manager, with a Windows-only companion service. Both frontends reuse `styles.css`. Windows audio access remains local to the Lenovo LOQ.

## Deployment

The project now has independent Netlify build configurations for NERV Deck and LOQ Link, same-origin short-lived Netlify Functions, and an authenticated Cloudflare Durable Object relay for the companion's outbound WebSocket connection.

See [deployment instructions](docs/deployment.md) for the architecture diagram, separate-site setup, required environment variables, preview/production separation, rollback, and current platform limitations. The exact HTTP and WebSocket payloads are documented in [the API contract](docs/api-contract.md).

Production deployment still requires the account owner to create the Netlify sites, configure provider-side secrets, deploy the Cloudflare Worker, and run the Windows companion. This checkout has no provider credentials, so it has not been deployed.

## Race calendars

The Home screen shows the next listed events, and the Race page shows the 2027 FIA WEC, IMSA WeatherTech, GT World Challenge Europe, and MotoGP schedules from `race-calendars.json`. Each series and event links to its official source. The catalogue records when its sources were checked; it is schedule metadata, not live timing. GT World Challenge Europe is explicitly marked partial because its full 2027 calendar has not been published.

The Race page also includes locally bundled representative cars for Hypercar, GT3/LMGT3, GTP, LMP2, and Rally1. Per-image photographer, source, and license links are shown with the gallery; the images are class references, not confirmed 2027 entry lists. See [race image credits](docs/race-image-credits.md).

## Run the dashboard

Serve the project directory with a local static server, or deploy the front-end separately. For local development:

```powershell
python -m http.server 8080
```

Open `http://localhost:8080`. For isolated direct-local companion testing, the dashboard origin must be listed in `NERV_ALLOWED_ORIGINS`; production pairing uses the cloud relay.

## Run LOQ Link on Windows

From the project directory:

```powershell
pip install -r requirements.txt
$env:NERV_PAIRING_TOKEN = "<set a strong random pairing code>"
$env:NERV_ALLOWED_ORIGINS = "http://localhost:8080"
python -m windows_companion.server
```

The companion binds to `127.0.0.1` by default. To allow direct tablet access over a LAN, provide a trusted TLS certificate and private key, configure `NERV_COMPANION_HOST=0.0.0.0`, and add the dashboard's exact HTTPS origin to `NERV_ALLOWED_ORIGINS`. The service refuses non-loopback binding without TLS. Do not put the pairing secret or TLS private key in dashboard JavaScript or commit them to the project.

For local development, pair from the **Connect** page using the LOQ Link HTTPS address and pairing secret. For production, configure the outbound relay and pair from either Netlify frontend with the pairing code. Pairing returns a random session that expires after eight hours; the dashboard keeps it in tab-scoped session storage and clears the entered pairing code. Disconnect revokes that viewer session.

## Audio support

LOQ Link enumerates Windows render endpoints through Core Audio and reports the Windows name, state, default roles, reported form factor, available endpoint volume/mute controls, and the endpoint's current shared mix format when readable.

Implemented controls:

- View Windows-reported playback endpoints, including unavailable states.
- Set an active endpoint as the Windows Console and Multimedia default output.
- Set endpoint master volume and mute when Windows exposes those controls.
- Refresh endpoint state to reflect removal, reconnection, and default-device changes.

The current mix format is informational; it is not a list of all formats supported by a device. Windows default-device selection is system-wide, not per application. Multi-output grouping, synchronized network audio, delay compensation, Android receiver registration, audio transport, and true-surround configuration are not implemented. No surround capability is claimed.

## Companion API

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Basic service readiness; no device telemetry |
| `POST` | `/pair` | Pairing secret | Issue a short-lived session |
| `POST` | `/disconnect` | Bearer session | Revoke the current session |
| `GET` | `/metrics` | Bearer session | CPU, memory, battery (when present), uptime |
| `GET` | `/audio/devices` | Bearer session | Windows playback endpoint snapshot |
| `POST` | `/audio/default` | Bearer session | Select the system default playback output |
| `POST` | `/audio/volume` | Bearer session | Set endpoint master volume, 0–100 |
| `POST` | `/audio/mute` | Bearer session | Set endpoint mute state |
| `WS` | `/ws` | Session token in first JSON message | Periodic system telemetry |

The companion does not use a built-in pairing key, wildcard CORS, or unauthenticated control routes. Configure origins narrowly. Public cloud access still needs a separately designed secure relay; ordinary serverless hosting is not the laptop audio path.

## Validation notes

The endpoint integration must be exercised on the target Windows laptop to verify actual HDMI/TV, USB, AUX, Bluetooth, routing, and volume behavior. Those physical-device checks cannot be inferred from this workspace. The service reports only what Windows exposes and responds with unavailable/unsupported states rather than fabricated hardware values.

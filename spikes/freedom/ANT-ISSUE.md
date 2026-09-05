# Draft issue for Ant (Freedom Browser's Swarm node): whole-file GET returns 200 and truncates the body on the first chunk retrieval failure

Collected 2026-09-05 while testing swarmtyp's S1 page in Freedom Browser. Draft for `solardev-xyz/freedom-browser` (or the Ant repository, if separate); fill in the repository and the Ant commit before filing.

## Environment

- `antd 0.5.43` ("Ant Swarm light node (M1.0)"), `ant-gateway/0.5.43`, API version `7.2.0`, from `freedom-browser` checkout `5722d2af` (`ant-bin/linux-x64/antd`, 19 MB).
- Linux x86_64, Node 22 for the harness, Freedom run from source (Electron 43).
- Config written by Freedom for a fresh dev profile (`FREEDOM_DEV_HOME`), mode ultraLight, no stamps, `swap-enable: false`, `skip-postage-snapshot: true`, `cors-allowed-origins: "null"`, ~100 peers within 30 s of start. Same behaviour when the identical binary and config run standalone (`antd --config … --no-control-socket`).
- Content: a 42 MB collection uploaded from a Bee 2.8.2 light node and retrievable from `download.gateway.ethswarm.org`, reference `7b737cf499e6b2322824f0c74b66985e30ceba9241a5c95a2210331c075ed9fb`; the file in question is `compiler/typst_ts_web_compiler_bg.wasm.gz`, 10,767,675 bytes (about 2,630 chunks), also reachable as `/bytes/387a0f3ba4556592adcaa51104b68624218552cdda454d631258c7276ebff61e`.

## Steps

```
A=http://127.0.0.1:22023   # Ant API
R=7b737cf499e6b2322824f0c74b66985e30ceba9241a5c95a2210331c075ed9fb
curl -s -o /dev/null -D - -w "http %{http_code} body %{size_download} bytes in %{time_total}s\n" \
  "$A/bzz/$R/compiler/typst_ts_web_compiler_bg.wasm.gz"
```

## Observed

Every attempt answers `200 OK` with the full `Content-Length: 10767675` and then closes the body early. Successive attempts on the same node get further, because the chunks already fetched come from the disk cache and the stream dies at the first chunk that has to come from the network and fails:

| attempt | body bytes | time |
|---|---|---|
| 1 | 303,104 | 2.5 s |
| 2 | 368,640 | 2.2 s |
| 3 | 434,176 | 1.3 s |
| 4 (next session, same cache) | 1,409,024 | 2.1 s |
| 5 (`/bytes/<ref>` route) | 2,846,720 | 3.1 s |
| 6 | 5,836,800 | 5.2 s |
| 7 | 10,767,675 (complete) | 6.1 s |

Response headers of a truncated attempt:

```
HTTP/1.1 200 OK
content-type: application/gzip
content-length: 10767675
accept-ranges: bytes
content-disposition: inline; filename="typst_ts_web_compiler_bg.wasm.gz"
cache-control: public, max-age=31536000, immutable
etag: "387a0f3ba4556592adcaa51104b68624218552cdda454d631258c7276ebff61e"
server: ant-gateway/0.5.43
```

`curl` reports the short body without an error; browsers surface it as `TypeError: Failed to fetch` (Chromium in Freedom, `bzz://` scheme) after about 13 s, with no retry.

Debug log (`--log-level debug`) during a truncated request shows per-chunk retrieval errors and no retry of that chunk within the request:

```
DEBUG ant_retrieval: remote returned error peer=Qmbd… err=retrieve chunk: storage: not found
DEBUG ant_retrieval: remote returned error peer=QmUa… err=retrieve chunk: no peer found
```

No `ant_gateway` request log line appears at debug level, so the request itself is not visible in the log.

Range requests work and are unaffected: `Range: bytes=0-1048575` answers `206` with exactly 1,048,576 bytes (2.1 s cold, 5 ms from cache). Small whole files (20 KB, 461 KB, 972 KB) complete: 0.8 s, 4.3 s, 7.7 s cold (60–125 KB/s).

## Expected

One of: retry the failing chunk (other peers, backoff) before giving up, as Bee does within `Swarm-Chunk-Retrieval-Timeout`; or terminate the response in a way the client can detect (chunked transfer without a final chunk is detectable, a `Content-Length` with a short body is not by every client); or send `503` if no bytes were written yet. A `200` with `Content-Length` and a silently short body makes clients cache or accept a corrupt file.

## Workaround used

Fetch in 1 MB `Range` pieces with per-piece retry (swarmtyp `spikes/s1/pages/index.html`, `fetchRanged`). With a fresh Ant inside Freedom (ultra-light, ~117 peers, no local Bee peer) the 10.8 MB file arrived complete in 11 pieces, two in parallel, in 303 s (36 KB/s; single pieces took 14–66 s), and the page then compiled and rendered. Whole-file GETs of the same file on the same node kept truncating until the disk cache held everything.

## Also worth a note (separate, smaller)

- The dev profile finds a Bee on the ecosystem port 1633 and shows "External Nodes Detected"; in legacy profile mode (`FREEDOM_TEST_USER_DATA`) it silently reuses that node without asking. Expected: the same choice in both modes.
- `--log-level debug` logs retrieval errors but no gateway request lines, so a truncated response cannot be correlated with a request in the log.

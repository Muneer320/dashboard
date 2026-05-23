# Ascent public frontend

The participant/admin web interface from Ascent 2026, preserved as part of the [historical dashboard archive](../README.md). The public landing page, FAQ and merchandise display can be explored locally; the original participant services are disconnected and checkout is closed.

From this directory, with Node.js/npm installed (verified with Node 24):

```sh
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 5177
```

Open http://127.0.0.1:5177. The archive notice remains visible. Use a fresh browser profile and synthetic inputs only. Authenticated screens are retained as source; this preview does not provide a working backend, account or participant dataset.

The original local artwork and logo are used for the landing preview. Historical sponsor names remain text where old hosted logos are unavailable. Promotional figures are historical copy, not verified usage evidence. Merchandise remains sold out, and former payment/form destinations have been scrubbed.

The production npm audit is clear after a compatible router update. Development-tool audit findings and bundle-size warnings remain recorded separately; this historical stack is not certified for a new deployment. See [archive notes](../ARCHIVE_NOTES.md) and preserve all teammate credits and licensing boundaries described in the main README.

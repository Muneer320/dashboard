# Mirage processor test harness

A small, self-contained end-to-end test for `mirage_processor`. It downloads
two well-known public face photos (Obama + Biden from the classic
`ageitgey/face_recognition` sample set), enrolls them as two test people,
processes two event photos, and asserts the correct matches were written to
Supabase.

It is isolated from real data:

- Test event slug: `mirage-test-event`
- Test photo ids prefixed with `mirage-test:`
- Test people display names end in `(test)`
- Everything above is cleaned up by `cleanup.py`

## What it proves

| Event photo        | Expected `photo_people` rows                     |
|--------------------|---------------------------------------------------|
| `obama2.jpg`       | Barack Obama (test)                               |
| `two_people.jpg`   | Barack Obama (test) **and** Joe Biden (test)      |

If these match, the whole pipeline works: anchor embedding, FAISS per-event
store, face detection + embedding, threshold-based matching, Supabase upserts,
and the `event_photos` / `photo_people` writes.

Matcher tuning knobs:

- `MIRAGE_DEFAULT_THRESHOLD` sets the minimum best-match score.
- `MIRAGE_MATCH_TOP_K` sets how many nearest anchor embeddings are compared per detected face.
- `MIRAGE_MATCH_MARGIN` rejects a label when the best competing person is too close in score.
- Repeating a person in `people.csv` with different anchor filenames enrolls multiple anchors for that identity.

## Requirements

- Processor dependencies installed: `pip install -r processor/requirements.txt`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in your environment (same as the
  real processor).
- Network access for the one-time sample download.

## Run it

From the repo root:

```powershell
python -m processor.testing.download_samples
python -m processor.testing.prepare_dataset
python -m processor.testing.run_test
```

First run will also trigger InsightFace to download the `buffalo_l` model into
its cache; that is a one-time cost.

## Clean up

```powershell
python -m processor.testing.cleanup
```

Removes the test rows from Supabase (`photos`, `event_photos`, `photo_people`,
`events`, `people`) and the local FAISS index directory for the test event.

## Customising the dataset

`dataset_sources.json` controls everything:

- `people[]` — each person has one `anchor` image URL and `display_name`.
- `event_photos[]` — each photo has a URL, a caption, and the list of
  `expected_people` (exactly the display names expected to appear in
  `photo_people` after processing).

Swap in your own image URLs, re-run the three steps above, and the verifier
will use the new ground truth. All ids stay under `mirage-test:` so the same
cleanup script still works.

---

## Rise Up 2025 benchmark (from `photos.json`)

Build **solo anchors** and **event / group** images from the real
`photos.json` “Rise up 2025” bucket. For each Drive URL, ground truth is the
**intersection** of people tagged in `photos.json` and the people you
successfully enrolled (so partial tagging is handled correctly).

Defaults: **100** enrolled identities, **400** test images (can take a long
time: hundreds of Drive downloads + face counting). Use **Python 3.11** on
Windows (InsightFace is unstable on 3.13).

```powershell
cd e:\HARSHIT\mirage

# Build dataset (wipes processor/testing/dataset unless --resume)
py -3.11 -m processor.testing.build_riseup_dataset
# or explicitly:
py -3.11 -m processor.testing.build_riseup_dataset --limit-people 100 --event-photos 400

# Enroll + process + print precision / recall / F1 / exact-set rate
py -3.11 -m processor.testing.run_benchmark

# Tear down Supabase + local FAISS + benchmark_report.json
py -3.11 -m processor.testing.cleanup
```

**Accuracy metrics** (see `processor/testing/run_benchmark.py`):

- **Micro-precision** — among all predicted person labels on evaluated photos,
  how many were in the `photos.json` expected set for that photo.
- **Micro-recall** — among all expected enrolled labels, how many the pipeline
  retrieved.
- **Exact set match rate** — fraction of photos where predicted set equals
  expected set exactly.

Report JSON: `processor/testing/dataset/benchmark_report.json`.

**Resume** after an interrupted build:

```powershell
py -3.11 -m processor.testing.build_riseup_dataset --resume
```

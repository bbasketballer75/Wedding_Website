## Runtime budgets — `http://127.0.0.1:56036`

Target: internal-static (`rebuild/dist`); response compression: gzip; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |   Transfer |  Requests (long tasks) | Valid runs | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ---------: | ---------------------: | ---------: | ------ |
| / (mobile)         | 3344 ms | 0.0002 | 153 ms | 1520 ms | 1521 ms | 370.27 KiB |  46 (9 long / 1575 ms) |  3/3 valid | FAIL   |
| /gallery (mobile)  | 3348 ms | 0.0000 | 154 ms | 1527 ms | 1528 ms | 326.99 KiB |   28 (6 long / 701 ms) |  3/3 valid | FAIL   |
| /film (mobile)     | 2196 ms | 0.0000 | 154 ms | 1549 ms | 1549 ms | 357.28 KiB |   57 (8 long / 998 ms) |  3/3 valid | FAIL   |
| / (desktop)        | 3632 ms | 0.0000 | 153 ms | 1609 ms | 1609 ms | 370.27 KiB | 46 (12 long / 1817 ms) |  3/3 valid | FAIL   |
| /gallery (desktop) | 3460 ms | 0.0000 | 153 ms | 1552 ms | 1552 ms | 329.88 KiB |   36 (7 long / 870 ms) |  1/3 valid | FAIL   |
| /film (desktop)    |     n/a | 0.0000 |    n/a |     n/a |     n/a |   0.00 KiB | null (null long / n/a) |  0/3 valid | FAIL   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |       css |      font |    image |     data |      total |
| ------------------ | ---------: | --------: | --------: | -------: | -------: | ---------: |
| / (mobile)         | 280.08 KiB | 27.43 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 370.27 KiB |
| /gallery (mobile)  | 273.06 KiB | 27.43 KiB | 22.63 KiB | 2.53 KiB | 0.00 KiB | 326.99 KiB |
| /film (mobile)     | 273.43 KiB | 27.43 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 357.28 KiB |
| / (desktop)        | 280.08 KiB | 27.43 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 370.27 KiB |
| /gallery (desktop) | 273.06 KiB | 27.43 KiB | 22.63 KiB | 5.42 KiB | 0.00 KiB | 329.88 KiB |
| /film (desktop)    |   0.00 KiB |  0.00 KiB |  0.00 KiB | 0.00 KiB | 0.00 KiB |   0.00 KiB |

- LCP element (first measured run): / mobile=p.mt-2.max-w-xl, /gallery mobile=p.mt-3.max-w-2xl, /film mobile=a.shrink-0.px-3, / desktop=p.mt-2.max-w-xl, /gallery desktop=h1.mt-2.font-display, /film desktop=n/a
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: changed-during-run; invalid runs: 5 of 18.

Invalid runs (excluded from medians, never counted as PASS):

- /gallery (desktop): no LCP observed (page did not paint); boot error: Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.; no LCP observed (page did not paint); boot error: Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.
- /film (desktop): no LCP observed (page did not paint); boot error: Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.; no LCP observed (page did not paint); boot error: Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.; no LCP observed (page did not paint); boot error: Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.

### Before vs after — baseline `tools/perf/output/baseline-before-fix-compressed.json`

Baseline label: before-fix (route-splitting + CLS fix not applied); captured: 2026-11-09T19:08:00.000Z. Deltas are after - before (negative LCP/CLS is an improvement).

| Route (viewport)   | LCP before | LCP after |    Δ LCP | CLS before | CLS after |   Δ CLS |  Δ transfer |
| ------------------ | ---------: | --------: | -------: | ---------: | --------: | ------: | ----------: |
| / (mobile)         |    4084 ms |   3344 ms |  -740 ms |     0.0293 |    0.0002 | -0.0291 |   -0.85 KiB |
| /gallery (mobile)  |    2828 ms |   3348 ms |  +520 ms |     1.0000 |    0.0000 |      -1 |   -35.4 KiB |
| /film (mobile)     |    2728 ms |   2196 ms |  -532 ms |     1.0293 |    0.0000 | -1.0293 |  -44.81 KiB |
| / (desktop)        |    2620 ms |   3632 ms | +1012 ms |     0.6389 |    0.0000 | -0.6389 |  -39.27 KiB |
| /gallery (desktop) |    2620 ms |   3460 ms |  +840 ms |     0.6389 |    0.0000 | -0.6389 |   -35.4 KiB |
| /film (desktop)    |    2872 ms |       n/a |      n/a |     0.6389 |    0.0000 |     n/a | -402.09 KiB |

### ❌ Budget violations

- **/ (mobile)**: lcp 3344 ms > 2000 ms
- **/gallery (mobile)**: lcp 3348 ms > 2000 ms
- **/film (mobile)**: lcp 2196 ms > 2000 ms
- **/ (desktop)**: lcp 3632 ms > 2000 ms
- **/gallery (desktop)**: lcp 3460 ms > 2000 ms
- **/film (desktop)**: no valid run (no LCP observed (page did not paint); boot error: Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.; no LCP observed (page did not paint); boot error: Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.; no LCP observed (page did not paint); boot error: Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.)

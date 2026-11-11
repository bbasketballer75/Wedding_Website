## Runtime budgets — `http://127.0.0.1:59985`

Target: internal-static (`tmp/dist-prod`); response compression: gzip; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |   Transfer | Requests (long tasks) | Valid runs | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ---------: | --------------------: | ---------: | ------ |
| / (mobile)         |  924 ms | 0.0000 | 153 ms | 2090 ms | 2090 ms | 374.80 KiB | 46 (7 long / 1121 ms) |  3/3 valid | PASS   |
| /gallery (mobile)  |  924 ms | 0.0000 | 153 ms | 2160 ms | 2161 ms | 344.26 KiB |  37 (5 long / 677 ms) |  3/3 valid | PASS   |
| /film (mobile)     |  936 ms | 0.0000 | 154 ms | 2099 ms | 2099 ms | 361.75 KiB |  56 (5 long / 819 ms) |  3/3 valid | PASS   |
| / (desktop)        |  932 ms | 0.0007 | 154 ms | 2152 ms | 2152 ms | 374.80 KiB | 46 (9 long / 1297 ms) |  3/3 valid | PASS   |
| /gallery (desktop) | 1000 ms | 0.0005 | 153 ms | 2299 ms | 2299 ms | 347.15 KiB | 45 (7 long / 1084 ms) |  3/3 valid | PASS   |
| /film (desktop)    |  988 ms | 0.0010 | 154 ms | 2263 ms | 2264 ms | 361.75 KiB | 56 (9 long / 1476 ms) |  3/3 valid | PASS   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |       css |      font |    image |     data |      total |
| ------------------ | ---------: | --------: | --------: | -------: | -------: | ---------: |
| / (mobile)         | 283.60 KiB | 27.46 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 374.80 KiB |
| /gallery (mobile)  | 290.61 KiB | 27.46 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 344.26 KiB |
| /film (mobile)     | 277.06 KiB | 27.46 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 361.75 KiB |
| / (desktop)        | 283.60 KiB | 27.46 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 374.80 KiB |
| /gallery (desktop) | 290.61 KiB | 27.46 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 347.15 KiB |
| /film (desktop)    | 277.06 KiB | 27.46 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 361.75 KiB |

- LCP element (first measured run): / mobile=style, /gallery mobile=style, /film mobile=style, / desktop=style, /gallery desktop=style, /film desktop=style
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: stable; invalid runs: 0 of 18.

### Before vs after — baseline `tools/perf/output/baseline-before-fix-compressed.json`

Baseline label: before-fix (route-splitting + CLS fix not applied); captured: 2026-11-09T19:08:00.000Z. Deltas are after - before (negative LCP/CLS is an improvement).

| Route (viewport)   | LCP before | LCP after |    Δ LCP | CLS before | CLS after |   Δ CLS | Δ transfer |
| ------------------ | ---------: | --------: | -------: | ---------: | --------: | ------: | ---------: |
| / (mobile)         |    4084 ms |    924 ms | -3160 ms |     0.0293 |    0.0000 | -0.0293 |  +3.68 KiB |
| /gallery (mobile)  |    2828 ms |    924 ms | -1904 ms |     1.0000 |    0.0000 |      -1 | -18.13 KiB |
| /film (mobile)     |    2728 ms |    936 ms | -1792 ms |     1.0293 |    0.0000 | -1.0293 | -40.34 KiB |
| / (desktop)        |    2620 ms |    932 ms | -1688 ms |     0.6389 |    0.0007 | -0.6382 | -34.74 KiB |
| /gallery (desktop) |    2620 ms |   1000 ms | -1620 ms |     0.6389 |    0.0005 | -0.6384 | -18.13 KiB |
| /film (desktop)    |    2872 ms |    988 ms | -1884 ms |     0.6389 |    0.0010 | -0.6379 | -40.34 KiB |

### ✅ All runtime budgets met

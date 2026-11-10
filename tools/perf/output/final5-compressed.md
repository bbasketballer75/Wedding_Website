## Runtime budgets — `http://127.0.0.1:54308`

Target: internal-static (`tmp/dist-prod`); response compression: gzip; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |    LCP |    CLS |   TTFB |     DCL |    load |   Transfer |  Requests (long tasks) | Valid runs | Budget |
| ------------------ | -----: | -----: | -----: | ------: | ------: | ---------: | ---------------------: | ---------: | ------ |
| / (mobile)         | 960 ms | 1.0000 | 153 ms | 1764 ms | 1764 ms | 377.81 KiB |  51 (9 long / 1916 ms) |  3/3 valid | FAIL   |
| /gallery (mobile)  | 908 ms | 1.0000 | 153 ms | 1662 ms | 1662 ms | 349.03 KiB |   45 (4 long / 579 ms) |  3/3 valid | FAIL   |
| /film (mobile)     | 908 ms | 1.0000 | 153 ms | 1620 ms | 1620 ms | 364.79 KiB |   61 (4 long / 473 ms) |  3/3 valid | FAIL   |
| / (desktop)        | 920 ms | 0.6396 | 154 ms | 1617 ms | 1617 ms | 377.81 KiB | 51 (12 long / 1785 ms) |  3/3 valid | FAIL   |
| /gallery (desktop) | 928 ms | 0.6394 | 153 ms | 1671 ms | 1671 ms | 351.92 KiB |   53 (5 long / 508 ms) |  3/3 valid | FAIL   |
| /film (desktop)    | 920 ms | 0.6399 | 153 ms | 1619 ms | 1619 ms | 364.79 KiB |   61 (5 long / 510 ms) |  3/3 valid | FAIL   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |       css |      font |    image |     data |      total |
| ------------------ | ---------: | --------: | --------: | -------: | -------: | ---------: |
| / (mobile)         | 286.63 KiB | 27.44 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 377.81 KiB |
| /gallery (mobile)  | 295.39 KiB | 27.44 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 349.03 KiB |
| /film (mobile)     | 280.11 KiB | 27.44 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 364.79 KiB |
| / (desktop)        | 286.63 KiB | 27.44 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 377.81 KiB |
| /gallery (desktop) | 295.39 KiB | 27.44 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 351.92 KiB |
| /film (desktop)    | 280.11 KiB | 27.44 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 364.79 KiB |

- LCP element (first measured run): / mobile=style, /gallery mobile=style, /film mobile=style, / desktop=style, /gallery desktop=style, /film desktop=style
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: stable; invalid runs: 0 of 18.

### Before vs after — baseline `tools/perf/output/baseline-before-fix-compressed.json`

Baseline label: before-fix (route-splitting + CLS fix not applied); captured: 2026-11-09T19:08:00.000Z. Deltas are after - before (negative LCP/CLS is an improvement).

| Route (viewport)   | LCP before | LCP after |    Δ LCP | CLS before | CLS after |   Δ CLS | Δ transfer |
| ------------------ | ---------: | --------: | -------: | ---------: | --------: | ------: | ---------: |
| / (mobile)         |    4084 ms |    960 ms | -3124 ms |     0.0293 |    1.0000 | +0.9707 |  +6.69 KiB |
| /gallery (mobile)  |    2828 ms |    908 ms | -1920 ms |     1.0000 |    1.0000 |       0 | -13.36 KiB |
| /film (mobile)     |    2728 ms |    908 ms | -1820 ms |     1.0293 |    1.0000 | -0.0293 |  -37.3 KiB |
| / (desktop)        |    2620 ms |    920 ms | -1700 ms |     0.6389 |    0.6396 | +0.0007 | -31.73 KiB |
| /gallery (desktop) |    2620 ms |    928 ms | -1692 ms |     0.6389 |    0.6394 | +0.0005 | -13.36 KiB |
| /film (desktop)    |    2872 ms |    920 ms | -1952 ms |     0.6389 |    0.6399 |  +0.001 |  -37.3 KiB |

### ❌ Budget violations

- **/ (mobile)**: cls 1.0000 > 0.05
- **/gallery (mobile)**: cls 1.0000 > 0.05
- **/film (mobile)**: cls 1.0000 > 0.05
- **/ (desktop)**: cls 0.6396 > 0.05
- **/gallery (desktop)**: cls 0.6394 > 0.05
- **/film (desktop)**: cls 0.6399 > 0.05

CLS contributors (largest layout shift in the first measured run):

- / (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /gallery (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /film (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- / (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /gallery (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /film (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0

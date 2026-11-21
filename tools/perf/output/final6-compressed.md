## Runtime budgets — `http://127.0.0.1:49886`

Target: internal-static (`tmp/dist-prod`); response compression: gzip; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |   Transfer |  Requests (long tasks) | Valid runs | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ---------: | ---------------------: | ---------: | ------ |
| / (mobile)         |  924 ms | 0.0000 | 153 ms | 1688 ms | 1688 ms | 377.88 KiB |  51 (9 long / 1728 ms) |  3/3 valid | PASS   |
| /gallery (mobile)  |  920 ms | 0.0000 | 153 ms | 1653 ms | 1653 ms | 349.10 KiB |   45 (5 long / 700 ms) |  3/3 valid | PASS   |
| /film (mobile)     |  920 ms | 0.0000 | 153 ms | 1638 ms | 1638 ms | 364.86 KiB |   61 (5 long / 670 ms) |  3/3 valid | PASS   |
| / (desktop)        | 1092 ms | 0.0007 | 158 ms | 1945 ms | 1953 ms | 377.88 KiB | 51 (15 long / 4920 ms) |  3/3 valid | PASS   |
| /gallery (desktop) |  912 ms | 0.0005 | 153 ms | 1749 ms | 1750 ms | 351.99 KiB |   53 (6 long / 710 ms) |  3/3 valid | PASS   |
| /film (desktop)    | 1076 ms | 0.0010 | 160 ms | 1866 ms | 1867 ms | 364.86 KiB | 61 (10 long / 1664 ms) |  3/3 valid | PASS   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |       css |      font |    image |     data |      total |
| ------------------ | ---------: | --------: | --------: | -------: | -------: | ---------: |
| / (mobile)         | 286.70 KiB | 27.44 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 377.88 KiB |
| /gallery (mobile)  | 295.47 KiB | 27.44 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 349.10 KiB |
| /film (mobile)     | 280.18 KiB | 27.44 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 364.86 KiB |
| / (desktop)        | 286.70 KiB | 27.44 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 377.88 KiB |
| /gallery (desktop) | 295.47 KiB | 27.44 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 351.99 KiB |
| /film (desktop)    | 280.18 KiB | 27.44 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 364.86 KiB |

- LCP element (first measured run): / mobile=style, /gallery mobile=style, /film mobile=style, / desktop=style, /gallery desktop=style, /film desktop=style
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: stable; invalid runs: 0 of 18.

### Before vs after — baseline `tools/perf/output/baseline-before-fix-compressed.json`

Baseline label: before-fix (route-splitting + CLS fix not applied); captured: 2026-11-09T19:08:00.000Z. Deltas are after - before (negative LCP/CLS is an improvement).

| Route (viewport)   | LCP before | LCP after |    Δ LCP | CLS before | CLS after |   Δ CLS | Δ transfer |
| ------------------ | ---------: | --------: | -------: | ---------: | --------: | ------: | ---------: |
| / (mobile)         |    4084 ms |    924 ms | -3160 ms |     0.0293 |    0.0000 | -0.0293 |  +6.76 KiB |
| /gallery (mobile)  |    2828 ms |    920 ms | -1908 ms |     1.0000 |    0.0000 |      -1 | -13.29 KiB |
| /film (mobile)     |    2728 ms |    920 ms | -1808 ms |     1.0293 |    0.0000 | -1.0293 | -37.23 KiB |
| / (desktop)        |    2620 ms |   1092 ms | -1528 ms |     0.6389 |    0.0007 | -0.6382 | -31.66 KiB |
| /gallery (desktop) |    2620 ms |    912 ms | -1708 ms |     0.6389 |    0.0005 | -0.6384 | -13.29 KiB |
| /film (desktop)    |    2872 ms |   1076 ms | -1796 ms |     0.6389 |    0.0010 | -0.6379 | -37.23 KiB |

### ✅ All runtime budgets met

## Runtime budgets — `http://127.0.0.1:60936`

Target: internal-static (`tmp/dist-prod`); response compression: gzip; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |   Transfer |  Requests (long tasks) | Valid runs | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ---------: | ---------------------: | ---------: | ------ |
| / (mobile)         |  940 ms | 0.0000 | 153 ms | 1666 ms | 1666 ms | 372.76 KiB |  49 (8 long / 1237 ms) |  3/3 valid | PASS   |
| /gallery (mobile)  |  940 ms | 0.0000 | 153 ms | 1636 ms | 1636 ms | 329.33 KiB |   32 (6 long / 646 ms) |  3/3 valid | PASS   |
| /film (mobile)     | 1120 ms | 0.0000 | 154 ms | 1626 ms | 1626 ms | 360.01 KiB |  59 (8 long / 1149 ms) |  3/3 valid | PASS   |
| / (desktop)        |  992 ms | 0.0007 | 155 ms | 1803 ms | 1804 ms | 372.76 KiB | 49 (16 long / 2822 ms) |  3/3 valid | PASS   |
| /gallery (desktop) | 1004 ms | 0.0005 | 154 ms | 1959 ms | 1959 ms | 332.22 KiB |  40 (7 long / 1339 ms) |  3/3 valid | PASS   |
| /film (desktop)    | 1012 ms | 0.0010 | 155 ms | 1855 ms | 1856 ms | 360.01 KiB |  59 (9 long / 1697 ms) |  3/3 valid | PASS   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |       css |      font |    image |     data |      total |
| ------------------ | ---------: | --------: | --------: | -------: | -------: | ---------: |
| / (mobile)         | 281.58 KiB | 27.44 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 372.76 KiB |
| /gallery (mobile)  | 275.70 KiB | 27.44 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 329.33 KiB |
| /film (mobile)     | 275.34 KiB | 27.44 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 360.01 KiB |
| / (desktop)        | 281.58 KiB | 27.44 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 372.76 KiB |
| /gallery (desktop) | 275.70 KiB | 27.44 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 332.22 KiB |
| /film (desktop)    | 275.34 KiB | 27.44 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 360.01 KiB |

- LCP element (first measured run): / mobile=style, /gallery mobile=style, /film mobile=style, / desktop=style, /gallery desktop=style, /film desktop=style
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: stable; invalid runs: 0 of 18.

### Before vs after — baseline `tools/perf/output/baseline-before-fix-compressed.json`

Baseline label: before-fix (route-splitting + CLS fix not applied); captured: 2026-11-09T19:08:00.000Z. Deltas are after - before (negative LCP/CLS is an improvement).

| Route (viewport)   | LCP before | LCP after |    Δ LCP | CLS before | CLS after |   Δ CLS | Δ transfer |
| ------------------ | ---------: | --------: | -------: | ---------: | --------: | ------: | ---------: |
| / (mobile)         |    4084 ms |    940 ms | -3144 ms |     0.0293 |    0.0000 | -0.0293 |  +1.64 KiB |
| /gallery (mobile)  |    2828 ms |    940 ms | -1888 ms |     1.0000 |    0.0000 |      -1 | -33.06 KiB |
| /film (mobile)     |    2728 ms |   1120 ms | -1608 ms |     1.0293 |    0.0000 | -1.0293 | -42.08 KiB |
| / (desktop)        |    2620 ms |    992 ms | -1628 ms |     0.6389 |    0.0007 | -0.6382 | -36.78 KiB |
| /gallery (desktop) |    2620 ms |   1004 ms | -1616 ms |     0.6389 |    0.0005 | -0.6384 | -33.06 KiB |
| /film (desktop)    |    2872 ms |   1012 ms | -1860 ms |     0.6389 |    0.0010 | -0.6379 | -42.08 KiB |

### ✅ All runtime budgets met

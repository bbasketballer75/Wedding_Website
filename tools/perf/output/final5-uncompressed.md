## Runtime budgets — `http://127.0.0.1:49385`

Target: internal-static (`tmp/dist-prod`); response compression: none; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |    Transfer | Requests (long tasks) | Valid runs | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ----------: | --------------------: | ---------: | ------ |
| / (mobile)         | 2972 ms | 1.0000 | 153 ms | 4089 ms | 4089 ms | 1179.18 KiB | 51 (8 long / 1225 ms) |  3/3 valid | FAIL   |
| /gallery (mobile)  | 2980 ms | 1.0000 | 153 ms | 4093 ms | 4093 ms | 1168.54 KiB |  45 (5 long / 602 ms) |  3/3 valid | FAIL   |
| /film (mobile)     | 2996 ms | 1.0000 | 153 ms | 4129 ms | 4130 ms | 1162.81 KiB |  61 (5 long / 560 ms) |  3/3 valid | FAIL   |
| / (desktop)        | 2980 ms | 0.6396 | 154 ms | 4091 ms | 4092 ms | 1179.18 KiB | 51 (7 long / 1310 ms) |  3/3 valid | FAIL   |
| /gallery (desktop) | 2996 ms | 0.6394 | 153 ms | 4135 ms | 4136 ms | 1171.43 KiB |  53 (5 long / 769 ms) |  3/3 valid | FAIL   |
| /film (desktop)    | 3032 ms | 0.6399 | 154 ms | 4201 ms | 4201 ms | 1162.81 KiB | 61 (8 long / 1048 ms) |  3/3 valid | FAIL   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |        css |      font |    image |     data |       total |
| ------------------ | ---------: | ---------: | --------: | -------: | -------: | ----------: |
| / (mobile)         | 925.81 KiB | 185.86 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1179.18 KiB |
| /gallery (mobile)  | 953.15 KiB | 185.86 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 1168.54 KiB |
| /film (mobile)     | 916.29 KiB | 185.86 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1162.81 KiB |
| / (desktop)        | 925.81 KiB | 185.86 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1179.18 KiB |
| /gallery (desktop) | 953.15 KiB | 185.86 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 1171.43 KiB |
| /film (desktop)    | 916.29 KiB | 185.86 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1162.81 KiB |

- LCP element (first measured run): / mobile=style, /gallery mobile=style, /film mobile=style, / desktop=style, /gallery desktop=style, /film desktop=style
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: stable; invalid runs: 0 of 18.

### ❌ Budget violations

- **/ (mobile)**: lcp 2972 ms > 2000 ms; cls 1.0000 > 0.05
- **/gallery (mobile)**: lcp 2980 ms > 2000 ms; cls 1.0000 > 0.05
- **/film (mobile)**: lcp 2996 ms > 2000 ms; cls 1.0000 > 0.05
- **/ (desktop)**: lcp 2980 ms > 2000 ms; cls 0.6396 > 0.05
- **/gallery (desktop)**: lcp 2996 ms > 2000 ms; cls 0.6394 > 0.05
- **/film (desktop)**: lcp 3032 ms > 2000 ms; cls 0.6399 > 0.05

CLS contributors (largest layout shift in the first measured run):

- / (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /gallery (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /film (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- / (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /gallery (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /film (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0

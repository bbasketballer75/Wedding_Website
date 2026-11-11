## Runtime budgets — `http://127.0.0.1:51503`

Target: internal-static (`tmp/dist-prod`); response compression: none; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |    Transfer |  Requests (long tasks) | Valid runs | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ----------: | ---------------------: | ---------: | ------ |
| / (mobile)         | 3032 ms | 1.0000 | 154 ms | 4220 ms | 4221 ms | 1165.51 KiB |  49 (8 long / 1773 ms) |  3/3 valid | FAIL   |
| /gallery (mobile)  | 3192 ms | 1.0000 | 156 ms | 4256 ms | 4256 ms | 1118.17 KiB |   32 (6 long / 965 ms) |  3/3 valid | FAIL   |
| /film (mobile)     | 3052 ms | 1.0000 | 154 ms | 4145 ms | 4146 ms | 1148.90 KiB |  59 (9 long / 1279 ms) |  3/3 valid | FAIL   |
| / (desktop)        | 3068 ms | 0.6396 | 156 ms | 4130 ms | 4131 ms | 1165.51 KiB | 49 (11 long / 1560 ms) |  3/3 valid | FAIL   |
| /gallery (desktop) | 2988 ms | 0.6394 | 153 ms | 4087 ms | 4088 ms | 1121.06 KiB |   40 (5 long / 640 ms) |  3/3 valid | FAIL   |
| /film (desktop)    | 3012 ms | 0.6399 | 153 ms | 4094 ms | 4094 ms | 1148.90 KiB |  59 (7 long / 1042 ms) |  3/3 valid | FAIL   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |        css |      font |    image |     data |       total |
| ------------------ | ---------: | ---------: | --------: | -------: | -------: | ----------: |
| / (mobile)         | 912.17 KiB | 185.83 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1165.51 KiB |
| /gallery (mobile)  | 902.80 KiB | 185.83 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 1118.17 KiB |
| /film (mobile)     | 902.40 KiB | 185.83 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1148.90 KiB |
| / (desktop)        | 912.17 KiB | 185.83 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1165.51 KiB |
| /gallery (desktop) | 902.80 KiB | 185.83 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 1121.06 KiB |
| /film (desktop)    | 902.40 KiB | 185.83 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1148.90 KiB |

- LCP element (first measured run): / mobile=style, /gallery mobile=style, /film mobile=style, / desktop=style, /gallery desktop=style, /film desktop=style
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: stable; invalid runs: 0 of 18.

### ❌ Budget violations

- **/ (mobile)**: lcp 3032 ms > 2000 ms; cls 1.0000 > 0.05
- **/gallery (mobile)**: lcp 3192 ms > 2000 ms; cls 1.0000 > 0.05
- **/film (mobile)**: lcp 3052 ms > 2000 ms; cls 1.0000 > 0.05
- **/ (desktop)**: lcp 3068 ms > 2000 ms; cls 0.6396 > 0.05
- **/gallery (desktop)**: lcp 2988 ms > 2000 ms; cls 0.6394 > 0.05
- **/film (desktop)**: lcp 3012 ms > 2000 ms; cls 0.6399 > 0.05

CLS contributors (largest layout shift in the first measured run):

- / (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /gallery (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /film (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- / (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /gallery (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /film (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0

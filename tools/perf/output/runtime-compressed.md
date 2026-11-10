## Runtime budgets — `http://127.0.0.1:60001`

Target: internal-static (`rebuild/dist`); response compression: gzip; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |   Transfer | Requests (long tasks) | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ---------: | --------------------: | ------ |
| / (mobile)         | 2556 ms | 1.0293 | 153 ms | 2245 ms | 2245 ms | 409.54 KiB | 32 (7 long / 1076 ms) | FAIL   |
| /gallery (mobile)  | 2620 ms | 1.0000 | 153 ms | 2276 ms | 2276 ms | 362.39 KiB |  15 (5 long / 646 ms) | FAIL   |
| /film (mobile)     | 2564 ms | 1.0293 | 153 ms | 2224 ms | 2224 ms | 402.09 KiB |  44 (4 long / 526 ms) | FAIL   |
| / (desktop)        | 2748 ms | 0.6389 | 154 ms | 2344 ms | 2345 ms | 409.54 KiB | 32 (9 long / 1451 ms) | FAIL   |
| /gallery (desktop) | 2756 ms | 0.6389 | 153 ms | 2259 ms | 2259 ms | 365.28 KiB |  23 (7 long / 881 ms) | FAIL   |
| /film (desktop)    |    0 ms | 0.0000 | 153 ms |  403 ms |  404 ms |  76.03 KiB |     4 (0 long / 0 ms) | PASS   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |       css |      font |    image |     data |      total |
| ------------------ | ---------: | --------: | --------: | -------: | -------: | ---------: |
| / (mobile)         | 319.33 KiB | 27.42 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 409.54 KiB |
| /gallery (mobile)  | 308.44 KiB | 27.42 KiB | 22.63 KiB | 2.53 KiB | 0.00 KiB | 362.39 KiB |
| /film (mobile)     | 318.21 KiB | 27.42 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 402.09 KiB |
| / (desktop)        | 319.33 KiB | 27.42 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 409.54 KiB |
| /gallery (desktop) | 308.44 KiB | 27.42 KiB | 22.63 KiB | 5.42 KiB | 0.00 KiB | 365.28 KiB |
| /film (desktop)    |  73.30 KiB |  1.37 KiB |  0.00 KiB | 0.00 KiB | 0.00 KiB |  76.03 KiB |

- LCP element (first measured run): / mobile=h2.mt-4.font-display, /gallery mobile=h2.mt-4.font-display, /film mobile=h2.mt-4.font-display, / desktop=h2.mt-4.font-display, /gallery desktop=h2.mt-4.font-display, /film desktop=n/a
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).

### ❌ Budget violations

- **/ (mobile)**: lcp 2556 ms > 2000 ms; cls 1.0293 > 0.05
- **/gallery (mobile)**: lcp 2620 ms > 2000 ms; cls 1.0000 > 0.05
- **/film (mobile)**: lcp 2564 ms > 2000 ms; cls 1.0293 > 0.05
- **/ (desktop)**: lcp 2748 ms > 2000 ms; cls 0.6389 > 0.05
- **/gallery (desktop)**: lcp 2756 ms > 2000 ms; cls 0.6389 > 0.05

CLS contributors (largest layout shift in the first measured run):

- / (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /gallery (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /film (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- / (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /gallery (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0

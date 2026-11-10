## Runtime budgets — `http://127.0.0.1:4175`

Target: external-url; response compression: as-served-by-target; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |    Transfer | Requests (long tasks) | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ----------: | --------------------: | ------ |
| / (mobile)         | 6796 ms | 1.0293 | 153 ms | 4094 ms | 4095 ms | 1170.88 KiB | 64 (9 long / 1528 ms) | FAIL   |
| /gallery (mobile)  | 6776 ms | 1.0000 | 154 ms | 4057 ms | 4058 ms | 1122.07 KiB |  46 (6 long / 791 ms) | FAIL   |
| /film (mobile)     | 6776 ms | 1.0293 | 154 ms | 4063 ms | 4064 ms | 1154.21 KiB |  73 (7 long / 855 ms) | FAIL   |
| / (desktop)        | 6828 ms | 0.6389 | 154 ms | 4112 ms | 4113 ms | 1170.88 KiB | 64 (9 long / 1546 ms) | FAIL   |
| /gallery (desktop) | 6840 ms | 0.6389 | 155 ms | 4062 ms | 4062 ms | 1124.96 KiB | 54 (7 long / 1000 ms) | FAIL   |
| /film (desktop)    | 4696 ms | 0.0000 | 154 ms | 3999 ms | 3999 ms |  823.27 KiB |  17 (4 long / 792 ms) | FAIL   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |        css |      font |    image |     data |       total |
| ------------------ | ---------: | ---------: | --------: | -------: | -------: | ----------: |
| / (mobile)         | 918.66 KiB | 185.80 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1170.88 KiB |
| /gallery (mobile)  | 906.10 KiB | 185.80 KiB | 22.63 KiB | 2.53 KiB | 0.00 KiB | 1122.07 KiB |
| /film (mobile)     | 908.32 KiB | 185.80 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1154.21 KiB |
| / (desktop)        | 918.66 KiB | 185.80 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1170.88 KiB |
| /gallery (desktop) | 906.10 KiB | 185.80 KiB | 22.63 KiB | 5.42 KiB | 0.00 KiB | 1124.96 KiB |
| /film (desktop)    | 611.23 KiB | 185.80 KiB | 22.63 KiB | 0.00 KiB | 0.00 KiB |  823.27 KiB |

- LCP element (first measured run): / mobile=h2.mt-4.font-display, /gallery mobile=h2.mt-4.font-display, /film mobile=h2.mt-4.font-display, / desktop=h2.mt-4.font-display, /gallery desktop=h2.mt-4.font-display, /film desktop=h2.mt-4.font-display
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).

### ❌ Budget violations

- **/ (mobile)**: lcp 6796 ms > 2000 ms; cls 1.0293 > 0.05
- **/gallery (mobile)**: lcp 6776 ms > 2000 ms; cls 1.0000 > 0.05
- **/film (mobile)**: lcp 6776 ms > 2000 ms; cls 1.0293 > 0.05
- **/ (desktop)**: lcp 6828 ms > 2000 ms; cls 0.6389 > 0.05
- **/gallery (desktop)**: lcp 6840 ms > 2000 ms; cls 0.6389 > 0.05
- **/film (desktop)**: lcp 4696 ms > 2000 ms

CLS contributors (largest layout shift in the first measured run):

- / (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /gallery (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /film (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- / (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /gallery (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0

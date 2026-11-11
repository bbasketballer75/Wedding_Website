## Runtime budgets — `http://127.0.0.1:4175`

Target: external-url; response compression: as-served-by-target; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |    Transfer | Requests (long tasks) | Valid runs | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ----------: | --------------------: | ---------: | ------ |
| / (mobile)         | 5744 ms | 1.0293 | 153 ms | 3951 ms | 3951 ms | 1161.38 KiB |  45 (6 long / 981 ms) |  3/3 valid | FAIL   |
| /gallery (mobile)  | 5800 ms | 1.0000 | 153 ms | 3951 ms | 3952 ms | 1114.62 KiB |  28 (5 long / 495 ms) |  3/3 valid | FAIL   |
| /film (mobile)     | 6040 ms | 1.0000 | 153 ms | 4054 ms | 4054 ms | 1145.10 KiB |  54 (5 long / 900 ms) |  3/3 valid | FAIL   |
| / (desktop)        | 5848 ms | 0.6389 | 154 ms | 4008 ms | 4008 ms | 1161.61 KiB | 45 (7 long / 1142 ms) |  3/3 valid | FAIL   |
| /gallery (desktop) | 5960 ms | 0.6389 | 154 ms | 3982 ms | 3982 ms | 1117.79 KiB |  36 (6 long / 738 ms) |  3/3 valid | FAIL   |
| /film (desktop)    | 5956 ms | 0.6389 | 153 ms | 4020 ms | 4020 ms | 1145.10 KiB |  54 (7 long / 923 ms) |  3/3 valid | FAIL   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |        css |      font |    image |     data |       total |
| ------------------ | ---------: | ---------: | --------: | -------: | -------: | ----------: |
| / (mobile)         | 910.68 KiB | 185.80 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1161.38 KiB |
| /gallery (mobile)  | 901.26 KiB | 185.80 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 1114.62 KiB |
| /film (mobile)     | 900.51 KiB | 185.83 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1145.10 KiB |
| / (desktop)        | 910.68 KiB | 185.83 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1161.61 KiB |
| /gallery (desktop) | 901.31 KiB | 185.83 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 1117.79 KiB |
| /film (desktop)    | 900.51 KiB | 185.83 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1145.10 KiB |

- LCP element (first measured run): / mobile=h2.mt-4.font-display, /gallery mobile=p.mt-4.max-w-lg, /film mobile=p.mt-4.max-w-lg, / desktop=h2.mt-4.font-display, /gallery desktop=h2.mt-4.font-display, /film desktop=h2.mt-4.font-display
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: n/a (external URL, not fingerprinted); invalid runs: 0 of 18.

### ❌ Budget violations

- **/ (mobile)**: lcp 5744 ms > 2000 ms; cls 1.0293 > 0.05
- **/gallery (mobile)**: lcp 5800 ms > 2000 ms; cls 1.0000 > 0.05
- **/film (mobile)**: lcp 6040 ms > 2000 ms; cls 1.0000 > 0.05
- **/ (desktop)**: lcp 5848 ms > 2000 ms; cls 0.6389 > 0.05
- **/gallery (desktop)**: lcp 5960 ms > 2000 ms; cls 0.6389 > 0.05
- **/film (desktop)**: lcp 5956 ms > 2000 ms; cls 0.6389 > 0.05

CLS contributors (largest layout shift in the first measured run):

- / (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /gallery (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /film (mobile): h1.font-display.text-3xl shift=0.001 moved from y=96 to y=95
- / (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /gallery (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /film (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0

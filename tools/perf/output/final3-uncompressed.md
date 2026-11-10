## Runtime budgets — `http://127.0.0.1:65166`

Target: internal-static (`tmp/dist-prod`); response compression: none; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |    Transfer | Requests (long tasks) | Valid runs | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ----------: | --------------------: | ---------: | ------ |
| / (mobile)         | 2968 ms | 1.0000 | 153 ms | 4058 ms | 4058 ms | 1179.33 KiB |  51 (7 long / 945 ms) |  3/3 valid | FAIL   |
| /gallery (mobile)  | 2956 ms | 1.0000 | 153 ms | 4090 ms | 4090 ms | 1168.70 KiB |  45 (3 long / 403 ms) |  3/3 valid | FAIL   |
| /film (mobile)     | 2940 ms | 1.0000 | 153 ms | 4030 ms | 4030 ms | 1162.97 KiB |  61 (4 long / 534 ms) |  3/3 valid | FAIL   |
| / (desktop)        | 2968 ms | 0.6396 | 153 ms | 4057 ms | 4057 ms | 1179.33 KiB |  51 (6 long / 845 ms) |  3/3 valid | FAIL   |
| /gallery (desktop) | 2960 ms | 0.6394 | 153 ms | 4066 ms | 4066 ms | 1171.59 KiB |  53 (4 long / 424 ms) |  3/3 valid | FAIL   |
| /film (desktop)    | 2988 ms | 0.6399 | 153 ms | 4083 ms | 4084 ms | 1162.97 KiB |  61 (3 long / 373 ms) |  3/3 valid | FAIL   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |        css |      font |    image |     data |       total |
| ------------------ | ---------: | ---------: | --------: | -------: | -------: | ----------: |
| / (mobile)         | 925.96 KiB | 185.86 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1179.33 KiB |
| /gallery (mobile)  | 953.31 KiB | 185.86 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 1168.70 KiB |
| /film (mobile)     | 916.45 KiB | 185.86 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1162.97 KiB |
| / (desktop)        | 925.96 KiB | 185.86 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1179.33 KiB |
| /gallery (desktop) | 953.31 KiB | 185.86 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 1171.59 KiB |
| /film (desktop)    | 916.45 KiB | 185.86 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1162.97 KiB |

- LCP element (first measured run): / mobile=style, /gallery mobile=style, /film mobile=style, / desktop=style, /gallery desktop=style, /film desktop=style
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: stable; invalid runs: 0 of 18.

### ❌ Budget violations

- **/ (mobile)**: lcp 2968 ms > 2000 ms; cls 1.0000 > 0.05
- **/gallery (mobile)**: lcp 2956 ms > 2000 ms; cls 1.0000 > 0.05
- **/film (mobile)**: lcp 2940 ms > 2000 ms; cls 1.0000 > 0.05
- **/ (desktop)**: lcp 2968 ms > 2000 ms; cls 0.6396 > 0.05
- **/gallery (desktop)**: lcp 2960 ms > 2000 ms; cls 0.6394 > 0.05
- **/film (desktop)**: lcp 2988 ms > 2000 ms; cls 0.6399 > 0.05

CLS contributors (largest layout shift in the first measured run):

- / (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /gallery (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- /film (mobile): footer.relative.overflow-hidden shift=1.000 moved from y=0 to y=0
- / (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /gallery (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0
- /film (desktop): footer.relative.overflow-hidden shift=0.639 moved from y=0 to y=0

## Runtime budgets — `http://127.0.0.1:61704`

Target: internal-static (`tmp/dist-prod`); response compression: none; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |    Transfer | Requests (long tasks) | Valid runs | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ----------: | --------------------: | ---------: | ------ |
| / (mobile)         | 3028 ms | 0.0000 | 154 ms | 5812 ms | 5812 ms | 1178.82 KiB | 46 (9 long / 1655 ms) |  3/3 valid | FAIL   |
| /gallery (mobile)  | 2972 ms | 0.0000 | 154 ms | 5711 ms | 5712 ms | 1166.06 KiB |  37 (6 long / 735 ms) |  3/3 valid | FAIL   |
| /film (mobile)     | 2980 ms | 0.0000 | 153 ms | 5760 ms | 5760 ms | 1162.41 KiB | 56 (7 long / 1105 ms) |  3/3 valid | FAIL   |
| / (desktop)        | 3056 ms | 0.0007 | 155 ms | 5979 ms | 5980 ms | 1178.82 KiB | 46 (9 long / 2358 ms) |  3/3 valid | FAIL   |
| /gallery (desktop) | 3164 ms | 0.0005 | 155 ms | 5929 ms | 5929 ms | 1168.95 KiB | 45 (9 long / 1591 ms) |  3/3 valid | FAIL   |
| /film (desktop)    | 3064 ms | 0.0010 | 155 ms | 5881 ms | 5881 ms | 1162.41 KiB | 56 (8 long / 1641 ms) |  3/3 valid | FAIL   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |        css |      font |    image |     data |       total |
| ------------------ | ---------: | ---------: | --------: | -------: | -------: | ----------: |
| / (mobile)         | 925.42 KiB | 185.88 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1178.82 KiB |
| /gallery (mobile)  | 950.65 KiB | 185.88 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 1166.06 KiB |
| /film (mobile)     | 915.86 KiB | 185.88 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1162.41 KiB |
| / (desktop)        | 925.42 KiB | 185.88 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1178.82 KiB |
| /gallery (desktop) | 950.65 KiB | 185.88 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 1168.95 KiB |
| /film (desktop)    | 915.86 KiB | 185.88 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1162.41 KiB |

- LCP element (first measured run): / mobile=style, /gallery mobile=style, /film mobile=style, / desktop=style, /gallery desktop=style, /film desktop=style
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: stable; invalid runs: 0 of 18.

### ❌ Budget violations

- **/ (mobile)**: lcp 3028 ms > 2000 ms
- **/gallery (mobile)**: lcp 2972 ms > 2000 ms
- **/film (mobile)**: lcp 2980 ms > 2000 ms
- **/ (desktop)**: lcp 3056 ms > 2000 ms
- **/gallery (desktop)**: lcp 3164 ms > 2000 ms
- **/film (desktop)**: lcp 3064 ms > 2000 ms

## Runtime budgets — `http://127.0.0.1:54284`

Target: internal-static (`tmp/dist-prod`); response compression: none; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |     LCP |    CLS |   TTFB |     DCL |    load |    Transfer | Requests (long tasks) | Valid runs | Budget |
| ------------------ | ------: | -----: | -----: | ------: | ------: | ----------: | --------------------: | ---------: | ------ |
| / (mobile)         | 2984 ms | 0.0000 | 154 ms | 4123 ms | 4123 ms | 1179.35 KiB | 51 (8 long / 1234 ms) |  3/3 valid | FAIL   |
| /gallery (mobile)  | 3004 ms | 0.0000 | 154 ms | 4113 ms | 4113 ms | 1168.71 KiB |  45 (7 long / 776 ms) |  3/3 valid | FAIL   |
| /film (mobile)     | 2960 ms | 0.0000 | 153 ms | 4073 ms | 4073 ms | 1162.98 KiB |  61 (5 long / 660 ms) |  3/3 valid | FAIL   |
| / (desktop)        | 2964 ms | 0.0007 | 153 ms | 4088 ms | 4089 ms | 1179.35 KiB | 51 (7 long / 1071 ms) |  3/3 valid | FAIL   |
| /gallery (desktop) | 2944 ms | 0.0005 | 153 ms | 4062 ms | 4063 ms | 1171.60 KiB |  53 (6 long / 654 ms) |  3/3 valid | FAIL   |
| /film (desktop)    | 2996 ms | 0.0010 | 153 ms | 4078 ms | 4078 ms | 1162.98 KiB |  61 (7 long / 916 ms) |  3/3 valid | FAIL   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |        css |      font |    image |     data |       total |
| ------------------ | ---------: | ---------: | --------: | -------: | -------: | ----------: |
| / (mobile)         | 925.98 KiB | 185.86 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1179.35 KiB |
| /gallery (mobile)  | 953.33 KiB | 185.86 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 1168.71 KiB |
| /film (mobile)     | 916.46 KiB | 185.86 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1162.98 KiB |
| / (desktop)        | 925.98 KiB | 185.86 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 1179.35 KiB |
| /gallery (desktop) | 953.33 KiB | 185.86 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 1171.60 KiB |
| /film (desktop)    | 916.46 KiB | 185.86 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 1162.98 KiB |

- LCP element (first measured run): / mobile=style, /gallery mobile=style, /film mobile=style, / desktop=style, /gallery desktop=style, /film desktop=style
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: stable; invalid runs: 0 of 18.

### ❌ Budget violations

- **/ (mobile)**: lcp 2984 ms > 2000 ms
- **/gallery (mobile)**: lcp 3004 ms > 2000 ms
- **/film (mobile)**: lcp 2960 ms > 2000 ms
- **/ (desktop)**: lcp 2964 ms > 2000 ms
- **/gallery (desktop)**: lcp 2944 ms > 2000 ms
- **/film (desktop)**: lcp 2996 ms > 2000 ms

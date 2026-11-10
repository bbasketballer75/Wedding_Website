## Runtime budgets — `http://127.0.0.1:49904`

Target: internal-static (`tmp/dist-prod`); response compression: gzip; mocked (supabase empty JSON, image stub, media aborted)

Profile: slow-4g (1.60 Mbps down, 750 kbps up, 150 ms RTT, CPU x4); 1 warm-up + 3 measured runs, median.

### Core Web Vitals proxies

| Route (viewport)   |    LCP |    CLS |   TTFB |     DCL |    load |   Transfer | Requests (long tasks) | Valid runs | Budget |
| ------------------ | -----: | -----: | -----: | ------: | ------: | ---------: | --------------------: | ---------: | ------ |
| / (mobile)         | 936 ms | 0.0000 | 153 ms | 1637 ms | 1637 ms | 377.85 KiB | 51 (8 long / 1164 ms) |  3/3 valid | PASS   |
| /gallery (mobile)  | 920 ms | 0.0000 | 153 ms | 1626 ms | 1627 ms | 349.07 KiB |  45 (4 long / 433 ms) |  3/3 valid | PASS   |
| /film (mobile)     | 924 ms | 0.0000 | 153 ms | 1617 ms | 1617 ms | 364.83 KiB |  61 (5 long / 702 ms) |  3/3 valid | PASS   |
| / (desktop)        | 924 ms | 0.0007 | 153 ms | 1614 ms | 1614 ms | 377.85 KiB | 51 (8 long / 1066 ms) |  3/3 valid | PASS   |
| /gallery (desktop) | 940 ms | 0.0005 | 153 ms | 1615 ms | 1616 ms | 351.96 KiB |  53 (5 long / 541 ms) |  3/3 valid | PASS   |
| /film (desktop)    | 904 ms | 0.0010 | 153 ms | 1590 ms | 1590 ms | 364.83 KiB |  61 (6 long / 771 ms) |  3/3 valid | PASS   |

### Transferred bytes by resource type (median)

| Route (viewport)   |     script |       css |      font |    image |     data |      total |
| ------------------ | ---------: | --------: | --------: | -------: | -------: | ---------: |
| / (mobile)         | 286.67 KiB | 27.44 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 377.85 KiB |
| /gallery (mobile)  | 295.44 KiB | 27.44 KiB | 22.63 KiB | 1.45 KiB | 0.00 KiB | 349.07 KiB |
| /film (mobile)     | 280.16 KiB | 27.44 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 364.83 KiB |
| / (desktop)        | 286.67 KiB | 27.44 KiB | 61.05 KiB | 0.36 KiB | 0.00 KiB | 377.85 KiB |
| /gallery (desktop) | 295.44 KiB | 27.44 KiB | 22.63 KiB | 4.34 KiB | 0.00 KiB | 351.96 KiB |
| /film (desktop)    | 280.16 KiB | 27.44 KiB | 45.69 KiB | 9.39 KiB | 0.00 KiB | 364.83 KiB |

- LCP element (first measured run): / mobile=style, /gallery mobile=style, /film mobile=style, / desktop=style, /gallery desktop=style, /film desktop=style
- Budgets: LCP <= 2000 ms, CLS <= 0.05 (QUALITY_BAR).
- Target consistency: stable; invalid runs: 0 of 18.

### ✅ All runtime budgets met

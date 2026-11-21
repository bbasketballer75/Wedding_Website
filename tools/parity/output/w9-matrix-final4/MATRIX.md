# Parity matrix — 2026-11-10T02:07:00.455Z

Oracle: http://127.0.0.1:4174 → rebuild: http://127.0.0.1:4175 (wave 9)

| Route        | Path                          | Viewport | Theme | Status  | Changed px | Ratio   | Text diffs | Heights (L/R) | First failure                                           |
| ------------ | ----------------------------- | -------- | ----- | ------- | ---------- | ------- | ---------- | ------------- | ------------------------------------------------------- |
| home         | `/`                           | desktop  | dark  | ALLOWED | 183        | 0.0018% | 0          | 10166 / 10166 | pixel `shots/diff/home__desktop__dark--s002.png`        |
| film         | `/film`                       | desktop  | dark  | PASS    | 2418       | 0.0233% | 0          | 5291 / 5291   | pixel `shots/diff/film__desktop__dark--s005.png`        |
| gallery      | `/gallery`                    | desktop  | dark  | FAIL    | 13904      | 0.1341% | 0          | 2151 / 2151   | pixel `shots/diff/gallery__desktop__dark--s001.png`     |
| upload       | `/upload`                     | desktop  | dark  | PASS    | 0          | 0.0000% | 0          | 3036 / 3036   |                                                         |
| guestbook    | `/guestbook`                  | desktop  | dark  | FAIL    | 12168      | 0.1174% | 0          | 2187 / 2187   | pixel `shots/diff/guestbook__desktop__dark--s002.png`   |
| guest-photos | `/guest-photos`               | desktop  | dark  | PASS    | 0          | 0.0000% | 0          | 1858 / 1858   |                                                         |
| activity     | `/activity`                   | desktop  | dark  | PASS    | 0          | 0.0000% | 0          | 1475 / 1475   |                                                         |
| admin-login  | `/admin/login`                | desktop  | dark  | FAIL    | 12144      | 0.1171% | 10         | 1928 / 1928   | text:title `text/diff/admin-login__desktop__dark.json`  |
| admin        | `/admin`                      | desktop  | dark  | FAIL    | 12144      | 0.1171% | 1          | 1928 / 1928   | text:links `text/diff/admin__desktop__dark.json`        |
| guest-token  | `/guest/valid-showcase-token` | desktop  | dark  | PASS    | 1612       | 0.0155% | 0          | 1593 / 1593   | pixel `shots/diff/guest-token__desktop__dark--s000.png` |
| not-found    | `/people`                     | desktop  | dark  | PASS    | 0          | 0.0000% | 0          | 1475 / 1475   |                                                         |

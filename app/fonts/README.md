# Vendored fonts

These files are committed to the repository on purpose. Do **not** replace them with
`next/font/google`.

## Why

`next/font/google` downloads font files from `fonts.googleapis.com` /
`fonts.gstatic.com` **at build time**. On an air-gapped LAN (bank intranet with no
outbound internet) the build fails or hangs. Vendoring the files and using
`next/font/local` removes the last external network dependency from `npm run build`.

## Files

| File | Family | Source |
| --- | --- | --- |
| `Geist-Variable.woff2` | Geist Sans | npm package `geist@1.7.2` → `dist/fonts/geist-sans/Geist-Variable.woff2` |
| `GeistMono-Variable.woff2` | Geist Mono | npm package `geist@1.7.2` → `dist/fonts/geist-mono/GeistMono-Variable.woff2` |

Both are variable fonts covering the `100 900` weight axis, which covers every weight
this app uses (and Tailwind's `font-mono` / `font-sans` utilities).

## Verifying / refreshing

```powershell
npm pack geist
tar -xzf geist-1.7.2.tgz
Copy-Item package/dist/fonts/geist-sans/Geist-Variable.woff2       app/fonts/
Copy-Item package/dist/fonts/geist-mono/GeistMono-Variable.woff2  app/fonts/
```

## Licence

Geist is licensed under the **SIL Open Font License 1.1**.
Full text: https://github.com/vercel/geist-font/blob/main/LICENSE.T1.txt

The licence text itself is not bundled here because this environment has no outbound
internet access to fetch it. Keep a copy of the licence text with these fonts if the
bank requires third-party licence attribution.

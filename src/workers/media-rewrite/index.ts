export default {
  async fetch(request: Request, env: { MEDIA_BUCKET: R2Bucket }): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;
    path = decodeURIComponent(path);

    let rewrittenPath = path;

    // Case 1: /media/_thumbs/Album/Photos/filename.webp
    if (rewrittenPath.startsWith('/media/_thumbs/')) {
      const inner = rewrittenPath.slice(15);

      if (inner.startsWith('Engagement/Photos/')) {
        const filename = inner.slice(18);
        rewrittenPath = 'professional/photos/proposal/' + filename;
      } else if (inner.startsWith('Bach+ette/Photos/') || inner.startsWith('Bach ette/Photos/')) {
        const filename = inner.slice(17);
        let mappedName = filename;
        if (mappedName.endsWith('.webp')) {
          mappedName = mappedName.slice(0, -5) + '.jpg';
        }
        rewrittenPath = 'media/Bach+ette/Photos/' + mappedName;
      } else if (inner.startsWith('Professional/Wedding Day/Photos/')) {
        let filename = inner.slice(32);
        if (filename.endsWith('.webp')) {
          filename = filename.slice(0, -5) + '.jpg';
        }
        rewrittenPath = 'media/Professional/Wedding Day/Photos/' + filename;
      } else if (inner.startsWith('Professional/')) {
        const afterPro = inner.slice(12);
        const slashIdx = afterPro.indexOf('/');
        if (slashIdx > 0) {
          const album = afterPro.slice(0, slashIdx);
          const rest = afterPro.slice(slashIdx + 1);
          rewrittenPath = `media/Professional/${album}/Photos/` + rest;
        }
      } else if (inner.startsWith('Guest Uploads/') || inner.startsWith('GuestUploads/')) {
        // Extract filename after "Guest Uploads/Wedding Day/Live Photos/Stills/"
        const afterGuest = inner.slice(14); // Skip "Guest Uploads/"
        // Find the Stills/ boundary
        const stillsIdx = afterGuest.indexOf('Stills/');
        if (stillsIdx > 0) {
          let filename = afterGuest.slice(stillsIdx + 7); // Skip "Stills/"
          if (filename.endsWith('.webp')) {
            filename = filename.slice(0, -5) + '.jpg';
          }
          rewrittenPath = 'media/Guest Uploads/Wedding Day/Live Photos/Stills/' + filename;
        } else {
          let filename = afterGuest;
          if (filename.endsWith('.webp')) {
            filename = filename.slice(0, -5) + '.jpg';
          }
          rewrittenPath = 'media/Guest Uploads/' + filename;
        }
      } else {
        rewrittenPath = 'media/' + inner;
      }
    }
    // Case 2: /_thumbs/Album/Photos/filename.webp
    else if (rewrittenPath.startsWith('/_thumbs/')) {
      const inner = rewrittenPath.slice(9);

      if (inner.startsWith('Engagement/Photos/')) {
        const filename = inner.slice(18);
        rewrittenPath = 'professional/photos/proposal/' + filename;
      } else if (inner.startsWith('Bach+ette/Photos/') || inner.startsWith('Bach ette/Photos/')) {
        const filename = inner.slice(17);
        let mappedName = filename;
        if (mappedName.endsWith('.webp')) {
          mappedName = mappedName.slice(0, -5) + '.jpg';
        }
        rewrittenPath = 'media/Bach+ette/Photos/' + mappedName;
      } else if (inner.startsWith('Professional/Wedding Day/Photos/')) {
        let filename = inner.slice(32);
        if (filename.endsWith('.webp')) {
          filename = filename.slice(0, -5) + '.jpg';
        }
        rewrittenPath = 'media/Professional/Wedding Day/Photos/' + filename;
      } else if (inner.startsWith('Professional/')) {
        const afterPro = inner.slice(12);
        const slashIdx = afterPro.indexOf('/');
        if (slashIdx > 0) {
          const album = afterPro.slice(0, slashIdx);
          const rest = afterPro.slice(slashIdx + 1);
          rewrittenPath = `media/Professional/${album}/Photos/` + rest;
        }
      } else if (inner.startsWith('Guest Uploads/') || inner.startsWith('GuestUploads/')) {
        // Extract filename after "Guest Uploads/Wedding Day/Live Photos/Stills/"
        const afterGuest = inner.slice(14); // Skip "Guest Uploads/"
        // Find the Stills/ boundary
        const stillsIdx = afterGuest.indexOf('Stills/');
        if (stillsIdx > 0) {
          let filename = afterGuest.slice(stillsIdx + 7); // Skip "Stills/"
          if (filename.endsWith('.webp')) {
            filename = filename.slice(0, -5) + '.jpg';
          }
          rewrittenPath = 'media/Guest Uploads/Wedding Day/Live Photos/Stills/' + filename;
        } else {
          let filename = afterGuest;
          if (filename.endsWith('.webp')) {
            filename = filename.slice(0, -5) + '.jpg';
          }
          rewrittenPath = 'media/Guest Uploads/' + filename;
        }
      } else {
        rewrittenPath = 'media/' + inner;
      }
    }
    // Case 3: /media/Bach+ette/... - direct access
    else if (rewrittenPath.startsWith('/media/Bach+ette/')) {
      rewrittenPath = path.slice(1);
    }
    // Case 4: /media/Professional/... - direct access
    else if (rewrittenPath.startsWith('/media/Professional/')) {
      rewrittenPath = path.slice(1);
    }
    // Case 5: /media/Guest Uploads/... - keep media prefix
    else if (rewrittenPath.startsWith('/media/Guest Uploads/') || rewrittenPath.startsWith('/media/Guest%20Uploads/')) {
      rewrittenPath = path.slice(1);
    }
    // Case 6: /media/Engagement/... - keep media prefix
    else if (rewrittenPath.startsWith('/media/Engagement/')) {
      rewrittenPath = path.slice(1);
    }
    // Case 7: /media/timeline/... - keep media prefix
    else if (rewrittenPath.startsWith('/media/timeline/')) {
      rewrittenPath = path.slice(1);
    }
    // Case 8: /media/... - strip /media prefix (catch-all, must be last)
    else if (rewrittenPath.startsWith('/media/')) {
      rewrittenPath = path.slice(7);
    }
    // Case 9: /background_audio/... - audio in R2 root
    else if (rewrittenPath.startsWith('/background_audio/')) {
      rewrittenPath = rewrittenPath.slice(1);
    }

    try {
      const object = await env.MEDIA_BUCKET.get(rewrittenPath);

      if (!object) {
        return new Response(`Not Found: ${rewrittenPath}`, {
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (e) {
      return new Response(`Error: ${e.message}`, { status: 500 });
    }
  },
} satisfies ExportedHandler<{ MEDIA_BUCKET: R2Bucket }>;

// Map DSC filename to actual R2 filename by position
// Supabase photos are ordered 1-503 by album_sort_order, matching sorted R2 files
const WEDDING_DAY_DSC_MAP: Record<string, string> = {
  'DSC00006.webp': '20250511_180812-0b9c.jpg',
  'DSC00014.webp': '20250511_180812-0f19.webp',
  'DSC00023.webp': '20250511_180812-29ee.webp',
  'DSC00024.webp': '20250511_180812-3321.webp',
  'DSC00039.webp': '20250511_180812-3414.webp',
  'DSC00042.webp': '20250511_180812-3d0a.webp',
  'DSC00052.webp': '20250511_180812-6c60.webp',
  'DSC00055.webp': '20250511_180812-806e.webp',
  'DSC00058.webp': '20250511_180812-8506.webp',
  'DSC00061.webp': '20250511_180812-b34a.webp',
  'DSC00069.webp': '20250511_180812-d798.webp',
  'DSC00072.webp': '20250511_180812-f074.webp',
  'DSC00073.webp': '20250511_180812-ff70.webp',
  'DSC00074.webp': '20250511_181413-2d20.webp',
  'DSC00075.webp': '20250511_181413-31d2.webp',
  'DSC00076.webp': '20250511_181413-6b51.webp',
  'DSC00078.webp': '20250511_181413-79d0.webp',
  'DSC00079.webp': '20250511_181413-8f40.webp',
  'DSC00080.webp': '20250511_181413-98d2.webp',
  'DSC00081.webp': '20250511_181413-ca89.webp',
  'DSC00082.webp': '20250511_181413-f2ec.webp',
  'DSC00083.webp': '20250511_181413-fe9e.webp',
  'DSC00084.webp': '20250511_181413-ff7a.webp',
  'DSC00086.webp': '20250511_181811-0ad6.webp',
  'DSC00088.webp': '20250511_181811-18c4.webp',
  'DSC00090.webp': '20250511_181811-1eb8.webp',
  'DSC00091.webp': '20250511_181811-272f.webp',
  'DSC00092.webp': '20250511_181811-2d0c.webp',
  'DSC00093.webp': '20250511_181811-3602.webp',
  'DSC00095.webp': '20250511_181811-3d1d.webp',
  'DSC00096.webp': '20250511_181811-44d2.webp',
  'DSC00097.webp': '20250511_181811-4cbc.webp',
  'DSC00099.webp': '20250511_181811-540f.webp',
  'DSC00100.webp': '20250511_181811-5d10.webp',
  'DSC00101.webp': '20250511_181811-6655.webp',
  'DSC00102.webp': '20250511_181811-6f16.webp',
  'DSC00103.webp': '20250511_181811-77e3.webp',
  'DSC00104.webp': '20250511_181811-80cb.webp',
  'DSC00105.webp': '20250511_181811-89d3.webp',
  'DSC00106.webp': '20250511_181811-932e.webp',
  'DSC00107.webp': '20250511_181811-9c63.webp',
  'DSC00108.webp': '20250511_181811-a4fc.webp',
  'DSC00109.webp': '20250511_181811-acfc.webp',
  'DSC00110.webp': '20250511_181811-b5d8.webp',
  'DSC00111.webp': '20250511_181811-bf9d.webp',
  'DSC00112.webp': '20250511_181811-c86c.webp',
  'DSC00114.webp': '20250511_181811-d1b2.webp',
  'DSC00115.webp': '20250511_181811-daa8.webp',
  'DSC00116.webp': '20250511_181811-e3b4.webp',
  'DSC00117.webp': '20250511_181811-ecf9.webp',
  'DSC00118.webp': '20250511_181811-f54c.webp',
  'DSC00119.webp': '20250511_181811-fe66.webp',
  'DSC00120.webp': '20250511_182012-0acd.webp',
  'DSC00121.webp': '20250511_182012-0f59.webp',
  'DSC00122.webp': '20250511_182012-17e5.webp',
  'DSC00123.webp': '20250511_182012-202e.webp',
  'DSC00124.webp': '20250511_182012-297e.webp',
  'DSC00125.webp': '20250511_182012-327d.webp',
  'DSC00126.webp': '20250511_182012-3a8c.webp',
  'DSC00127.webp': '20250511_182012-439e.webp',
  'DSC00128.webp': '20250511_182012-4b8a.webp',
  'DSC00129.webp': '20250511_182012-542f.webp',
  'DSC00130.webp': '20250511_182012-5c5f.webp',
  'DSC00131.webp': '20250511_182012-658e.webp',
  'DSC00132.webp': '20250511_182012-6e3e.webp',
  'DSC00133.webp': '20250511_182012-76d1.webp',
  'DSC00135.webp': '20250511_182012-7f56.webp',
  'DSC00136.webp': '20250511_182012-88b3.webp',
  'DSC00137.webp': '20250511_182012-90e8.webp',
  'DSC00138.webp': '20250511_182012-99b9.webp',
  'DSC00139.webp': '20250511_182012-a296.webp',
  'DSC00140.webp': '20250511_182012-ab3d.webp',
  'DSC00141.webp': '20250511_182012-b3c0.webp',
  'DSC00142.webp': '20250511_182012-bc75.webp',
  'DSC00143.webp': '20250511_182012-c4de.webp',
  'DSC00144.webp': '20250511_182012-cd7b.webp',
  'DSC00145.webp': '20250511_182012-d5e3.webp',
  'DSC00146.webp': '20250511_182012-de77.webp',
  'DSC00147.webp': '20250511_182012-e6f9.webp',
  'DSC00148.webp': '20250511_182012-ef62.webp',
  'DSC00149.webp': '20250511_182012-f7e5.webp',
  'DSC00151.webp': '20250511_182413-0ad1.webp',
  'DSC00152.webp': '20250511_182413-0eae.webp',
  'DSC00153.webp': '20250511_182413-1750.webp',
  'DSC00154.webp': '20250511_182413-204d.webp',
  'DSC00155.webp': '20250511_182413-28d1.webp',
  'DSC00156.webp': '20250511_182413-3182.webp',
  'DSC00157.webp': '20250511_182413-399f.webp',
  'DSC00159.webp': '20250511_182413-41e6.webp',
  'DSC00160.webp': '20250511_182413-4a56.webp',
  'DSC00161.webp': '20250511_182413-52f9.webp',
  'DSC00162.webp': '20250511_182413-5b06.webp',
  'DSC00163.webp': '20250511_182413-6377.webp',
  'DSC00164.webp': '20250511_182413-6c0f.webp',
  'DSC00165.webp': '20250511_182413-7454.webp',
  'DSC00166.webp': '20250511_182413-7c92.webp',
  'DSC00167.webp': '20250511_182413-8504.webp',
  'DSC00168.webp': '20250511_182413-8daa.webp',
  'DSC00170.webp': '20250511_182413-9646.webp',
  'DSC00171.webp': '20250511_182413-9e73.webp',
  'DSC00172.webp': '20250511_182413-a6eb.webp',
  'DSC00173.webp': '20250511_182413-af0f.webp',
  'DSC00174.webp': '20250511_182413-b7a1.webp',
  'DSC00175.webp': '20250511_182413-c01b.webp',
  'DSC00176.webp': '20250511_182413-c8a0.webp',
  'DSC00177.webp': '20250511_182413-d116.webp',
  'DSC00178.webp': '20250511_182413-d979.webp',
  'DSC00179.webp': '20250511_182413-e18e.webp',
  'DSC00180.webp': '20250511_182413-e9c3.webp',
  'DSC00181.webp': '20250511_182413-f25b.webp',
  'DSC00183.webp': '20250511_182413-fb00.webp',
  'DSC00184.webp': '20250511_182614-09ca.webp',
  'DSC00185.webp': '20250511_182614-108e.webp',
  'DSC00186.webp': '20250511_182614-186a.webp',
  'DSC00187.webp': '20250511_182614-21bb.webp',
  'DSC00188.webp': '20250511_182614-29e0.webp',
  'DSC00189.webp': '20250511_182614-3297.webp',
  'DSC00190.webp': '20250511_182614-3aaf.webp',
  'DSC00191.webp': '20250511_182614-42f9.webp',
  'DSC00192.webp': '20250511_182614-4b27.webp',
  'DSC00193.webp': '20250511_182614-53b1.webp',
  'DSC00194.webp': '20250511_182614-5c3f.webp',
  'DSC00195.webp': '20250511_182614-64bd.webp',
  'DSC00196.webp': '20250511_182614-6d51.webp',
  'DSC00197.webp': '20250511_182614-7631.webp',
  'DSC00198.webp': '20250511_182614-7eca.webp',
  'DSC00199.webp': '20250511_182614-8781.webp',
  'DSC00200.webp': '20250511_182614-8fbb.webp',
  'DSC00201.webp': '20250511_182614-98db.webp',
  'DSC00202.webp': '20250511_182614-a13b.webp',
  'DSC00203.webp': '20250511_182614-a9e9.webp',
  'DSC00204.webp': '20250511_182614-b2d2.webp',
  'DSC00205.webp': '20250511_182614-bb7d.webp',
  'DSC00206.webp': '20250511_182614-c47e.webp',
  'DSC00208.webp': '20250511_182614-cd3f.webp',
  'DSC00209.webp': '20250511_182614-d58e.webp',
  'DSC00210.webp': '20250511_182614-de3b.webp',
  'DSC00211.webp': '20250511_182614-e703.webp',
  'DSC00212.webp': '20250511_182614-ef6a.webp',
  'DSC00213.webp': '20250511_182614-f88f.webp',
  'DSC00215.webp': '20250511_182614-00f9.webp',
  'DSC00216.webp': '20250511_183114-0b3a.webp',
  'DSC00217.webp': '20250511_183114-0e9e.webp',
  'DSC00218.webp': '20250511_183114-1726.webp',
  'DSC00219.webp': '20250511_183114-1f8a.webp',
  'DSC00220.webp': '20250511_183114-27fe.webp',
  'DSC00221.webp': '20250511_183114-3030.webp',
  'DSC00222.webp': '20250511_183114-38a2.webp',
  'DSC00223.webp': '20250511_183114-40f4.webp',
  'DSC00224.webp': '20250511_183114-4966.webp',
  'DSC00225.webp': '20250511_183114-51d5.webp',
  'DSC00226.webp': '20250511_183114-5a72.webp',
  'DSC00227.webp': '20250511_183114-62e0.webp',
  'DSC00228.webp': '20250511_183114-6b64.webp',
  'DSC00229.webp': '20250511_183114-73b9.webp',
  'DSC00230.webp': '20250511_183114-7c2f.webp',
  'DSC00231.webp': '20250511_183114-852f.webp',
  'DSC00232.webp': '20250511_183114-8d7a.webp',
  'DSC00233.webp': '20250511_183114-9625.webp',
  'DSC00234.webp': '20250511_183114-9ed3.webp',
  'DSC00235.webp': '20250511_183114-a74d.webp',
  'DSC00236.webp': '20250511_183114-b03a.webp',
  'DSC00237.webp': '20250511_183114-b8be.webp',
  'DSC00238.webp': '20250511_183114-c15c.webp',
  'DSC00239.webp': '20250511_183114-ca0b.webp',
  'DSC00240.webp': '20250511_183114-d27b.webp',
  'DSC00242.webp': '20250511_183114-db33.webp',
  'DSC00243.webp': '20250511_183114-e400.webp',
  'DSC00244.webp': '20250511_183114-ecc0.webp',
  'DSC00245.webp': '20250511_183114-f59e.webp',
  'DSC00247.webp': '20250511_183114-fe62.webp',
  'DSC00248.webp': '20250511_183114-0700.webp',
  'DSC00249.webp': '20250511_183114-0fbb.webp',
  'DSC00250.webp': '20250511_183114-18b7.webp',
  'DSC00251.webp': '20250511_183114-2158.webp',
  'DSC00252.webp': '20250511_183114-2a41.webp',
  'DSC00253.webp': '20250511_183114-32e9.webp',
  'DSC00254.webp': '20250511_183114-3ba0.webp',
  'DSC00255.webp': '20250511_183114-4476.webp',
  'DSC00256.webp': '20250511_183114-4d27.webp',
  'DSC00257.webp': '20250511_183114-55d4.webp',
  'DSC00258.webp': '20250511_183114-5ec3.webp',
  'DSC00259.webp': '20250511_183114-677e.webp',
  'DSC00260.webp': '20250511_183114-707f.webp',
  'DSC00261.webp': '20250511_183114-79a5.webp',
  'DSC00262.webp': '20250511_183114-829e.webp',
  'DSC00263.webp': '20250511_183114-8b67.webp',
  'DSC00264.webp': '20250511_183114-93da.webp',
  'DSC00265.webp': '20250511_183114-9c83.webp',
  'DSC00266.webp': '20250511_183114-a554.webp',
  'DSC00267.webp': '20250511_183114-adf4.webp',
  'DSC00268.webp': '20250511_183114-b6da.webp',
  'DSC00269.webp': '20250511_183114-bf66.webp',
  'DSC00270.webp': '20250511_183114-c842.webp',
  'DSC00271.webp': '20250511_183114-d11b.webp',
  'DSC00272.webp': '20250511_183114-d9ec.webp',
  'DSC00273.webp': '20250511_183114-e304.webp',
  'DSC00274.webp': '20250511_183114-ec5c.webp',
  'DSC00275.webp': '20250511_183114-f515.webp',
  'DSC00276.webp': '20250511_183114-fdcd.webp',
  'DSC00278.webp': '20250511_183114-06a2.webp',
  'DSC00279.webp': '20250511_183114-0f46.webp',
  'DSC00280.webp': '20250511_183114-17ee.webp',
  'DSC00281.webp': '20250511_183114-2083.webp',
  'DSC00282.webp': '20250511_183114-2932.webp',
  'DSC00283.webp': '20250511_183114-31e4.webp',
  'DSC00284.webp': '20250511_183114-3ab5.webp',
  'DSC00285.webp': '20250511_183114-43a5.webp',
  'DSC00286.webp': '20250511_183114-4c63.webp',
  'DSC00287.webp': '20250511_183114-5551.webp',
  'DSC00288.webp': '20250511_183114-5e38.webp',
  'DSC00289.webp': '20250511_183114-670f.webp',
  'DSC00290.webp': '20250511_183114-6ff4.webp',
  'DSC00291.webp': '20250511_183114-78d8.webp',
  'DSC00292.webp': '20250511_183114-81b6.webp',
  'DSC00293.webp': '20250511_183114-8a9d.webp',
  'DSC00294.webp': '20250511_183114-938b.webp',
  'DSC00295.webp': '20250511_183114-9c87.webp',
  'DSC00296.webp': '20250511_183114-a56f.webp',
  'DSC00297.webp': '20250511_183114-ae59.webp',
  'DSC00298.webp': '20250511_183114-b755.webp',
  'DSC00299.webp': '20250511_183114-c056.webp',
  'DSC00300.webp': '20250511_183114-c956.webp',
  'DSC00301.webp': '20250511_183114-d264.webp',
  'DSC00302.webp': '20250511_183114-db7a.webp',
  'DSC00304.webp': '20250511_183114-e487.webp',
  'DSC00305.webp': '20250511_183114-ed5d.webp',
  'DSC00306.webp': '20250511_183114-f66e.webp',
  'DSC00307.webp': '20250511_183114-ff8c.webp',
  'DSC00308.webp': '20250511_183114-08a1.webp',
  'DSC00309.webp': '20250511_183114-1177.webp',
  'DSC00310.webp': '20250511_183114-1a60.webp',
  'DSC00311.webp': '20250511_183114-22f8.webp',
  'DSC00312.webp': '20250511_183114-2b84.webp',
  'DSC00313.webp': '20250511_183114-3493.webp',
  'DSC00314.webp': '20250511_183114-3d5e.webp',
  'DSC00315.webp': '20250511_183114-462f.webp',
  'DSC00316.webp': '20250511_183114-4f35.webp',
  'DSC00317.webp': '20250511_183114-5813.webp',
  'DSC00318.webp': '20250511_183114-6104.webp',
  'DSC00319.webp': '20250511_183114-69db.webp',
  'DSC00320.webp': '20250511_183114-7308.webp',
  'DSC00321.webp': '20250511_183114-7c0f.webp',
  'DSC00322.webp': '20250511_183114-850e.webp',
  'DSC00323.webp': '20250511_183114-8e05.webp',
  'DSC00324.webp': '20250511_183114-9702.webp',
  'DSC00325.webp': '20250511_183114-a00c.webp',
  'DSC00326.webp': '20250511_183114-a90b.webp',
  'DSC00327.webp': '20250511_183114-b22f.webp',
  'DSC00328.webp': '20250511_183114-bb4b.webp',
  'DSC00329.webp': '20250511_183114-c46f.webp',
  'DSC00330.webp': '20250511_183114-cd96.webp',
  'DSC00331.webp': '20250511_183114-d6c8.webp',
  'DSC00332.webp': '20250511_183114-dfea.webp',
  'DSC00333.webp': '20250511_183114-e8cf.webp',
  'DSC00334.webp': '20250511_183114-f1e6.webp',
  'DSC00335.webp': '20250511_183114-fad9.webp',
  'DSC00336.webp': '20250511_183114-03d8.webp',
  'DSC00337.webp': '20250511_183114-0ca4.webp',
  'DSC00338.webp': '20250511_183114-157b.webp',
  'DSC00339.webp': '20250511_183114-1e7e.webp',
  'DSC00340.webp': '20250511_183114-2764.webp',
  'DSC00341.webp': '20250511_183114-303f.webp',
  'DSC00342.webp': '20250511_183114-3934.webp',
  'DSC00343.webp': '20250511_183114-421d.webp',
  'DSC00344.webp': '20250511_183114-4b18.webp',
  'DSC00345.webp': '20250511_183114-5411.webp',
  'DSC00346.webp': '20250511_183114-5d06.webp',
  'DSC00347.webp': '20250511_183114-65f9.webp',
  'DSC00348.webp': '20250511_183114-6f00.webp',
  'DSC00349.webp': '20250511_183114-7806.webp',
  'DSC00350.webp': '20250511_183114-8106.webp',
  'DSC00351.webp': '20250511_183114-8a0e.webp',
  'DSC00352.webp': '20250511_183114-9308.webp',
  'DSC00353.webp': '20250511_183114-9bfd.webp',
  'DSC00354.webp': '20250511_183114-a4f9.webp',
  'DSC00355.webp': '20250511_183114-adf0.webp',
  'DSC00356.webp': '20250511_183114-b6df.webp',
  'DSC00357.webp': '20250511_183114-bfc2.webp',
  'DSC00358.webp': '20250511_183114-c8bf.webp',
  'DSC00359.webp': '20250511_183114-d1b1.webp',
  'DSC00360.webp': '20250511_183114-daa8.webp',
  'DSC00361.webp': '20250511_183114-e3a0.webp',
  'DSC00362.webp': '20250511_183114-ec9b.webp',
  'DSC00363.webp': '20250511_183114-f5a3.webp',
  'DSC00364.webp': '20250511_183114-fe98.webp',
  'DSC00365.webp': '20250511_183114-078f.webp',
  'DSC00366.webp': '20250511_183114-1080.webp',
  'DSC00367.webp': '20250511_183114-197f.webp',
  'DSC00368.webp': '20250511_183114-2275.webp',
  'DSC00369.webp': '20250511_183114-2b73.webp',
  'DSC00370.webp': '20250511_183114-3467.webp',
  'DSC00371.webp': '20250511_183114-3d4e.webp',
  'DSC00372.webp': '20250511_183114-463e.webp',
  'DSC00373.webp': '20250511_183114-4f44.webp',
  'DSC00374.webp': '20250511_183114-584e.webp',
  'DSC00375.webp': '20250511_183114-6154.webp',
  'DSC00376.webp': '20250511_183114-6a59.webp',
  'DSC00377.webp': '20250511_183114-7357.webp',
  'DSC00378.webp': '20250511_183114-7c53.webp',
  'DSC00379.webp': '20250511_183114-854f.webp',
  'DSC00380.webp': '20250511_183114-8e49.webp',
  'DSC00381.webp': '20250511_183114-9745.webp',
  'DSC00382.webp': '20250511_183114-a045.webp',
  'DSC00383.webp': '20250511_183114-a942.webp',
  'DSC00384.webp': '20250511_183114-b23d.webp',
  'DSC00385.webp': '20250511_183114-bb36.webp',
  'DSC00386.webp': '20250511_183114-c435.webp',
  'DSC00387.webp': '20250511_183114-cd37.webp',
  'DSC00388.webp': '20250511_183114-d641.webp',
  'DSC00389.webp': '20250511_183114-df47.webp',
  'DSC00390.webp': '20250511_183114-e84a.webp',
  'DSC00391.webp': '20250511_183114-f153.webp',
  'DSC00392.webp': '20250511_183114-fa5d.webp',
  'DSC00393.webp': '20250511_183114-0373.webp',
  'DSC00394.webp': '20250511_183114-0c6d.webp',
  'DSC00395.webp': '20250511_183114-156d.webp',
  'DSC00396.webp': '20250511_183114-1e70.webp',
  'DSC00397.webp': '20250511_183114-2771.webp',
  'DSC00398.webp': '20250511_183114-3068.webp',
  'DSC00399.webp': '20250511_183114-3962.webp',
  'DSC00400.webp': '20250511_183114-4261.webp',
  'DSC00401.webp': '20250511_183114-4b5c.webp',
  'DSC00402.webp': '20250511_183114-5462.webp',
  'DSC00403.webp': '20250511_183114-5d68.webp',
  'DSC00404.webp': '20250511_183114-6672.webp',
  'DSC00405.webp': '20250511_183114-6f81.webp',
  'DSC00406.webp': '20250511_183114-7891.webp',
  'DSC00407.webp': '20250511_183114-81a5.webp',
  'DSC00408.webp': '20250511_183114-8ab0.webp',
  'DSC00409.webp': '20250511_183114-93af.webp',
  'DSC00410.webp': '20250511_183114-9caf.webp',
  'DSC00411.webp': '20250511_183114-a5ad.webp',
  'DSC00412.webp': '20250511_183114-aeab.webp',
  'DSC00413.webp': '20250511_183114-b7ab.webp',
  'DSC00414.webp': '20250511_183114-c0aa.webp',
  'DSC00415.webp': '20250511_183114-c9ac.webp',
  'DSC00416.webp': '20250511_183114-d2b1.webp',
  'DSC00417.webp': '20250511_183114-dbc1.webp',
  'DSC00418.webp': '20250511_183114-e4cb.webp',
  'DSC00419.webp': '20250511_183114-ede0.webp',
  'DSC00420.webp': '20250511_183114-f6f2.webp',
  'DSC00421.webp': '20250511_183114-001b.webp',
  'DSC00422.webp': '20250511_183214-0b19.webp',
  'DSC00423.webp': '20250511_183214-0fbb.webp',
  'DSC00424.webp': '20250511_183214-182c.webp',
  'DSC00425.webp': '20250511_183214-20c3.webp',
  'DSC00426.webp': '20250511_183214-2946.webp',
  'DSC00427.webp': '20250511_183214-3257.webp',
  'DSC00428.webp': '20250511_183214-3acf.webp',
  'DSC00429.webp': '20250511_183214-43a5.webp',
  'DSC00430.webp': '20250511_183214-4c66.webp',
  'DSC00431.webp': '20250511_183214-5592.webp',
  'DSC00432.webp': '20250511_183214-5e7b.webp',
  'DSC00433.webp': '20250511_183214-674a.webp',
  'DSC00434.webp': '20250511_183214-70d6.webp',
  'DSC00435.webp': '20250511_183214-79bd.webp',
  'DSC00436.webp': '20250511_183214-82e1.webp',
  'DSC00437.webp': '20250511_183214-8c1c.webp',
  'DSC00438.webp': '20250511_183214-959a.webp',
  'DSC00439.webp': '20250511_183214-9ecb.webp',
  'DSC00440.webp': '20250511_183214-a802.webp',
  'DSC00441.webp': '20250511_183214-b15c.webp',
  'DSC00442.webp': '20250511_183214-bab6.webp',
  'DSC00443.webp': '20250511_183214-c407.webp',
  'DSC00444.webp': '20250511_183214-cd5d.webp',
  'DSC00445.webp': '20250511_183214-d699.webp',
  'DSC00446.webp': '20250511_183214-e02f.webp',
  'DSC00447.webp': '20220211_210000_00.jpg',
  'DSC00448.webp': '20220211_210210_01.jpg',
  'DSC00449.webp': '20220211_210231_02.jpg',
  'DSC00450.webp': '20220211_211042_03.jpg',
  'DSC00451.webp': '20220211_211142_04.jpg',
  'DSC00452.webp': '20220211_211301_05.jpg',
  'DSC00453.webp': '20220211_211341_06.jpg',
  'DSC00454.webp': '20220211_211430_07.jpg',
  'DSC00455.webp': '20220211_211537_08.jpg',
  'DSC00456.webp': '20220211_211636_09.jpg',
  'DSC00457.webp': '20220211_211718_10.jpg',
  'DSC00458.webp': '20220211_211816_11.jpg',
  'DSC00459.webp': '20220211_211851_12.jpg',
  'DSC00460.webp': '20220211_211924_13.jpg',
  'DSC00461.webp': '20220211_212009_14.jpg',
  'DSC00462.webp': '20220211_212112_15.jpg',
  'DSC00463.webp': '20220211_212200_16.jpg',
  'DSC00464.webp': '20220211_212237_17.jpg',
  'DSC00465.webp': '20220211_212322_18.jpg',
  'DSC00466.webp': '20220211_212404_19.jpg',
  'DSC00467.webp': '20220211_212444_20.jpg',
  'DSC00468.webp': '20220211_212533_21.jpg',
  'DSC00469.webp': '20220211_212616_22.jpg',
  'DSC00470.webp': '20220211_212700_23.jpg',
  'DSC00471.webp': '20220211_212737_24.jpg',
  'DSC00472.webp': '20220211_212817_25.jpg',
  'DSC00473.webp': '20220211_212907_26.jpg',
  'DSC00474.webp': '20220211_212952_27.jpg',
  'DSC00475.webp': '20220211_213034_28.jpg',
  'DSC00476.webp': '20220211_213105_29.jpg',
  'DSC09406.webp': 'alex-molnar.webp',
  'DSC09419.webp': 'austin.png',
  'DSC09422.webp': 'austin.webp',
  'DSC09429.webp': 'austins_ring1.webp',
  'DSC09440.webp': 'austins_ring2.webp',
  'DSC09446.webp': 'brinnah-helsel.webp',
  'DSC09447.webp': 'brosonan-mccray.webp',
  'DSC09448.webp': 'caitie-helsel.webp',
  'DSC09452.webp': 'christine.webp',
  'DSC09460.webp': 'ean-pringle.webp',
  'DSC09482.webp': 'eddie-migut.webp',
  'DSC09485.webp': 'emily-aurandt.webp',
  'DSC09486.webp': 'hannah-porada.webp',
  'DSC09488.webp': 'heather.webp',
  'DSC09491.webp': 'ian-porada.webp',
  'DSC09497.webp': 'intro-video-poster.png',
  'DSC09511.webp': 'jerame.webp',
  'DSC09515.webp': 'jordyn.png',
  'DSC09523.webp': 'jordyn.webp',
  'DSC09538.webp': 'jordyns_ring1.webp',
  'DSC09541.webp': 'jordyns_ring_2.webp',
  'DSC09550.webp': 'lexi-berkebile.webp',
  'DSC09565.webp': 'main-film-poster.png',
  'DSC09578.webp': 'maria-mccray.webp',
  'DSC09587.webp': 'melony.webp',
  'DSC09605.webp': 'micaela-helsel.webp',
  'DSC09615.webp': 'nate-berkebile.webp',
  'DSC09630.webp': 'tyler-sharpe.webp',
};

function mapWeddingDayFile(dscFilename: string): string {
  return WEDDING_DAY_DSC_MAP[dscFilename] || dscFilename;
}
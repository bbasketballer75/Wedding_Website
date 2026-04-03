import type { Context } from "https://edge.netlify.com";

interface GalleryItem {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const shareId = url.searchParams.get("share");

  // If no shareId is present, bypass the edge function
  if (!shareId) {
    return context.next();
  }

  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const supabaseKey = Netlify.env.get("VITE_SUPABASE_ANON_KEY");

  // If env vars are missing, just return the next response
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase Env vars missing in edge function");
    return context.next();
  }

  let photoData: GalleryItem | null = null;

  try {
    const supabaseEndpoint = `${supabaseUrl}/rest/v1/wedding_gallery?id=eq.${shareId}&select=id,title,description,image_url`;
    
    const apiResponse = await fetch(supabaseEndpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (apiResponse.ok) {
      const data = await apiResponse.json();
      if (data && data.length > 0) {
        photoData = data[0];
      }
    }
  } catch (error) {
    console.error("Error fetching photo from Supabase:", error);
  }

  const response = await context.next();

  // If we couldn't get the photo data, return the original response
  if (!photoData || !photoData.image_url) {
    return response;
  }

  // Ensure it's an HTML response before modifying
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("text/html")) {
    return response;
  }

  const siteTitle = "Porada Wedding Gallery";
  const ogTitle = photoData.title ? `${photoData.title} | ${siteTitle}` : `Beautiful Memory | ${siteTitle}`;
  const ogDesc = photoData.description || "Check out this beautiful moment from our wedding gallery.";
  
  // Create HTMLRewriter instance to update metas
  // HTMLRewriter is available globally in Netlify Edge Functions
  return new HTMLRewriter()
    .on('meta[property="og:title"]', {
      element(element: any) {
        element.setAttribute("content", ogTitle);
      },
    })
    .on('meta[name="twitter:title"]', {
      element(element: any) {
        element.setAttribute("content", ogTitle);
      },
    })
    .on('meta[property="og:description"]', {
      element(element: any) {
        element.setAttribute("content", ogDesc);
      },
    })
    .on('meta[name="twitter:description"]', {
      element(element: any) {
        element.setAttribute("content", ogDesc);
      },
    })
    .on('meta[property="og:image"]', {
      element(element: any) {
        element.setAttribute("content", photoData!.image_url);
      },
    })
    .on('meta[name="twitter:image"]', {
      element(element: any) {
        element.setAttribute("content", photoData!.image_url);
      },
    })
    .transform(response);
};

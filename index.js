const version = "0.0.3"

let allowedDomains = process?.env?.ALLOWED_REMOTE_DOMAINS?.split(",") || ["*"];
let imgproxyUrl = process?.env?.IMGPROXY_URL || "http://imgproxy:8080";
if (process.env.NODE_ENV === "development") {
    imgproxyUrl = "http://localhost:8888"
}
allowedDomains = allowedDomains.map(d => d.trim());

Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/") {
            return new Response(`<h3>Next Image Transformation v${version}</h3>More info <a href="https://github.com/coollabsio/next-image-transformation">https://github.com/coollabsio/next-image-transformation</a>.`, {
                headers: {
                    "Content-Type": "text/html",
                },
            });
        }

        if (url.pathname === "/health") {
            return new Response("OK");
        };
        if (url.pathname.startsWith("/image/")) return await resize(url);
        return Response.redirect("https://github.com/coollabsio/next-image-transformation", 302);
    }
});

function boundedInt(value, fallback, max) {
    if (value === null || value === "") return fallback;
    if (!/^\d{1,5}$/.test(value)) return null;
    const number = Number(value);
    return number <= max ? number : null;
}

async function resize(url) {
    const src = url.pathname.split("/").slice(2).join("/");
    const origin = new URL(src).hostname;
    const allowed = allowedDomains.filter(domain => {
        if (domain === "*") return true;
        if (domain === origin) return true;
        if (domain.startsWith("*.") && origin.endsWith(domain.split("*.").pop())) return true;
        return false;
    })
    if (allowed.length === 0) {
        return new Response(`Domain (${origin}) not allowed. More details here: https://github.com/coollabsio/next-image-transformation`, { status: 403 });
    }
    // These go into the imgproxy path, so anything but a bounded integer could inject processing
    // options or a second source URL past the domain allowlist.
    const width = boundedInt(url.searchParams.get("width"), 0, 8192);
    const height = boundedInt(url.searchParams.get("height"), 0, 8192);
    const quality = boundedInt(url.searchParams.get("quality"), 75, 100);
    if (width === null || height === null || quality === null) {
        return new Response("width, height and quality must be integers", { status: 400 });
    }
    try {
        // imgproxy always expects a signature segment; "insecure" is accepted while URL signing is off.
        // Upstream put the "pr:sharp" preset there, so older imgproxy read it as the signature (and never
        // applied it) and current imgproxy rejects the URL.
        const url = `${imgproxyUrl}/insecure/resize:fill:${width}:${height}/q:${quality}/plain/${src}`
        const image = await fetch(url, {
            headers: {
                "Accept": "image/avif,image/webp,image/apng,*/*",
            }
        })
        const headers = new Headers(image.headers);
        headers.set("Server", "NextImageTransformation");
        // Pass imgproxy's status through so errors are not served (and cached) as 200.
        return new Response(image.body, {
            status: image.status,
            headers
        })
    } catch (e) {
        console.log(e)
        return new Response("Error resizing image")
    }
}
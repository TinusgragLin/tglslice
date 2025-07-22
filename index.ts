import assert from "assert"

const blog_serve_dir = 'generated-blog-site'

function serve_blog(path: String): Response {
    assert(path.charAt(0) == '/')

    if (path.endsWith('/')) {
        path += 'index.html'
    } else {
        const last_segment = path.substring(path.lastIndexOf('/') + 1)
        if (!last_segment.includes('.')) {
            path += '/index.html'
        }
    }
    const maybe_file = blog_serve_dir + path
    return new Response(Bun.file(maybe_file))
}

Bun.serve({
    hostname: '0.0.0.0',
    port: '23333',
    fetch(request, server) {
        const req_url = new URL(request.url)
        const req_path = req_url.pathname

        if (req_path === '/blog') {
            return serve_blog('/')
        } else if (req_path.startsWith('/blog/')) {
            return serve_blog(req_path.substring(5))
        } else {
            return new Response(Bun.file('home/index.html'))
        }
    },
})

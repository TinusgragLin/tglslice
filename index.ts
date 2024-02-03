const blog_serve_dir = 'generated-blog-site'

function serve_blog(path: String): Response {
    if (path.endsWith('/')) {
        path += 'index.html'
    } else if (!path.substring(path.lastIndexOf('/') + 1).includes('.')) {
        path += '/index.html'
    }
    const maybe_file = blog_serve_dir + path
    return new Response(Bun.file(maybe_file))
}

Bun.serve({
    hostname: '0.0.0.0',
    port: '23333',
    fetch(request, _server) {
        const url = new URL(request.url)
        const path = url.pathname
        if (path === '/blog') {
            return serve_blog('/')
        } else if (path.startsWith('/blog/')) {
            return serve_blog(path.substring(5))
        } else {
            return new Response(Bun.file('home/index.html'))
        }
    },
})

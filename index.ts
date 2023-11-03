// import * as fs from 'node:fs';

const main_site_host = '0.0.0.0'
const blog_serve_dir = 'blog-zola/public'

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
    hostname: main_site_host,
    port: '2233',
    /* tls: {
        cert: fs.readFileSync('./tls/server.pem'),
        key: fs.readFileSync('./tls/server.key'),
    }, */
    fetch(request, server) {
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

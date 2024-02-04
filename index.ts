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

let visit_log: Map<string, [Date, string][]> = new Map()

function visit_log_dump(): string {
    const s: string[] = []
    visit_log.forEach((val, key) => {
        s.push(key + ':\n  ' + val.join('\n  '))
    })
    return s.join('\n')
}

Bun.serve({
    hostname: '0.0.0.0',
    port: '23333',
    fetch(request, server) {
        const req_url = new URL(request.url)
        const req_path = req_url.pathname

        const req_ip = server.requestIP(request)
        if (req_ip !== null) {
            const from = req_ip.address + ':' + req_ip.port
            const new_entry: [Date, string] = [new Date(), req_path]
            const lst = visit_log.get(from)
            if (lst === undefined) {
                visit_log.set(from, [new_entry])
            } else {
                lst.push(new_entry)
            }
        }

        if (req_path === '/statistics') {
            return new Response(visit_log_dump())
        } else if (req_path === '/blog') {
            return serve_blog('/')
        } else if (req_path.startsWith('/blog/')) {
            return serve_blog(req_path.substring(5))
        } else {
            return new Response(Bun.file('home/index.html'))
        }
    },
})

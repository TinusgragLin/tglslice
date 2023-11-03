FROM oven/bun:latest

COPY . .

RUN bun install
CMD ["bun", "run", "index.ts"]

EXPOSE 2233

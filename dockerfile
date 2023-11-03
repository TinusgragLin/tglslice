FROM oven/bun:latest

COPY . .

RUN bun install
RUN ./build.sh
CMD ["bun", "run", "index.ts"]

EXPOSE 2233

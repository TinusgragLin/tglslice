FROM oven/bun:latest

COPY . .

RUN ./build.sh
RUN bun install
CMD ["bun", "run", "index.ts"]

EXPOSE 23333

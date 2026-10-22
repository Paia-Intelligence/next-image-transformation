# Pinned Bun: the upstream image tracked a floating tag and was last built in 2024.
# Dependabot bumps this pin.
FROM oven/bun:1.4.4-alpine
WORKDIR /app
COPY package.json index.js ./
USER bun
EXPOSE 3000
CMD ["bun", "run", "start"]

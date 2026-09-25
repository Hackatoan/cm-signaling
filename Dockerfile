FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY server.js .
# Run as the image's built-in unprivileged user instead of root: this is a
# public-facing WebSocket endpoint, so a future RCE-class bug in this process
# or one of its deps shouldn't also hand an attacker root inside the container.
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]

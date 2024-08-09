FROM node:22-bookworm

COPY server.js /workspace/server.js

RUN cd /workspace && npm install node-pty ws http

RUN echo "root:${PASSWORD-test}" | chpasswd

CMD [ "node", "/workspace/server.js" ]
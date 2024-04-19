# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/devcontainers/typescript-node

SHELL [ "/bin/bash", "-c" ]

ENV HOME=/home/node

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
  && apt-get -y install --no-install-recommends \
  python3 flex \
  && apt-get clean && rm -rf /var/lib/apt/lists/* \
  && git clone https://github.com/emscripten-core/emsdk.git \
  && cd emsdk \
  && ./emsdk install latest \
  && ./emsdk activate latest \
  && echo 'source /emsdk/emsdk_env.sh' >> ~/.bashrc
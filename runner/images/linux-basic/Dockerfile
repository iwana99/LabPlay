FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        coreutils \
        findutils \
        grep \
        sed \
        gawk \
        tar \
        gzip \
        procps \
        iproute2 \
        iputils-ping \
        file \
        util-linux \
        less \
        nano \
        vim-tiny \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd bob \
    && useradd \
        --gid bob \
        --create-home \
        --shell /bin/bash \
        bob

WORKDIR /home/bob

CMD ["sh", "-c", "while true; do sleep 3600; done"]
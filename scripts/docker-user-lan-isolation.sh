#!/bin/sh
# Blocks this project's Docker network from reaching any private RFC1918
# range (the home LAN, other Docker networks on the host, VPN interfaces,
# etc.) — nothing in this stack (app, db, cloudflared, maintenance,
# uptime-kuma, beszel-hub) has a legitimate reason to talk to anything but
# the public internet and its own network's containers. A compromised
# container shouldn't be able to pivot onto the home network.
#
# Run by docker-compose.yml's `firewall-init` service (network_mode: host +
# NET_ADMIN, since DOCKER-USER is a host-level iptables chain, not reachable
# from a container's own network namespace) on every `docker compose up`, so
# this can never drift or be forgotten on a fresh host the way a hand-
# installed systemd unit could. Idempotent (checks with -C before -I) so
# it's safe to re-run on every redeploy without stacking duplicate rules.
#
# The SUBNET below must match docker-compose.yml's `networks: default: ipam:
# config: subnet:` — pinned there specifically so this can't silently drift
# from whatever Docker's IPAM allocator would otherwise pick.
#
# The established/related ACCEPT is inserted first (evaluated before the
# DROPs) — without it, reply traffic for connections a LAN device itself
# opens into a published container port (e.g. the SYN-ACK back to a browser
# hitting uptime-kuma/beszel-hub from the LAN) is indistinguishable from a
# container-initiated LAN connection by source/dest alone, since both have a
# SUBNET source and a 192.168.0.0/16 destination — it was getting silently
# dropped, breaking LAN access to any published port. This only allows
# *replies* to connections something outside the docker network opened; it
# does not let a container open new outbound connections into the LAN, which
# the DROP rules below still catch.
set -e
SUBNET="172.19.0.0/16"
iptables -C DOCKER-USER -s "$SUBNET" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || \
  iptables -I DOCKER-USER -s "$SUBNET" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
for dest in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16; do
  iptables -C DOCKER-USER -s "$SUBNET" -d "$dest" -j DROP 2>/dev/null || \
    iptables -I DOCKER-USER -s "$SUBNET" -d "$dest" -j DROP
done

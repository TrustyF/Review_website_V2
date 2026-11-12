#!/bin/sh
# Blocks this project's Docker network from reaching any private RFC1918
# range (the home LAN, other Docker networks on the host, VPN interfaces,
# etc.) — nothing in this stack (app, db, cloudflared, maintenance) has a
# legitimate reason to talk to anything but
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
# Replies to connections opened from outside (e.g. a LAN browser on a published port) must pass.
# -I puts a rule at the top, so this goes in last and is re-inserted every run to stay above the
# DROPs (it used to be inserted first, which left it below them and blocked those replies).
set -e
SUBNET="172.19.0.0/16"
for dest in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16; do
  iptables -C DOCKER-USER -s "$SUBNET" -d "$dest" -j DROP 2>/dev/null || \
    iptables -I DOCKER-USER -s "$SUBNET" -d "$dest" -j DROP
done
while iptables -D DOCKER-USER -s "$SUBNET" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null; do :; done
iptables -I DOCKER-USER -s "$SUBNET" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

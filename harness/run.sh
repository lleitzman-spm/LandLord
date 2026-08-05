#!/usr/bin/env bash
# Run a harness script INSIDE a Claude Code container, where outbound HTTPS must
# travel through the agent proxy. Node's built-in fetch ignores HTTPS_PROXY
# unless told to use it (see /root/.ccr/README.md), so this launcher sets the two
# switches the proxy needs and hands off to node.
#
# In a NORMAL environment (Edwin's machine, a plain VM) none of this is needed —
# just run `node harness/<script>` directly; there is no proxy to satisfy.
#
#   usage: ./harness/run.sh selftest.mjs [args...]
set -e
script="$1"; shift || true
exec env \
  NODE_USE_ENV_PROXY=1 \
  NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-/root/.ccr/ca-bundle.crt}" \
  node "harness/$script" "$@"

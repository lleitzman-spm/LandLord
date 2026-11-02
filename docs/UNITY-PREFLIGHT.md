# Unity preflight

Checked 2 November 2026, 15:29-15:31 UTC. This is a bounded infrastructure check for the approved Unity-first, downloadable PC slice. No editor, dependencies, license, or account configuration was installed or changed.

## Result

**Unity compilation, Editor import, Play Mode, and PC build are untested.** No usable local Unity Editor or Hub was found. Official Unity distribution, release metadata, package, and licensing routes are currently blocked by the environment's outbound policy. This establishes an infrastructure blocker; it does not reject Unity as the engine.

The approved gameplay target is an opening 20-30 minutes of landlord play, with room to explore and pressure building. The browser implementation remains reference material. Neither a successful browser build nor plain C# compilation would validate that Unity milestone.

## Local checks

| Check | Observed result |
| --- | --- |
| `command -v` equivalent using Python `shutil.which` for `Unity`, `unity`, `unity-editor`, `unityhub`, `UnityHub` | All absent from PATH. |
| Same check for `dotnet`, `mono`, `csc`, `mcs` | All absent from PATH. |
| Common `/opt` and home Unity/Hub/Editor installation paths; bounded file-name search under `/opt`, `/usr/local/bin`, `/usr/bin`, `/home`, `/root` to depth 6 | No Editor, Hub, or licensing-client executable found. The bounded `find` returned exit 1, so this is not an exhaustive claim about inaccessible directories. |
| Standard Unity state directories under the checked root home and system locations | Absent. Other-user standard Hub/Unity paths produced no candidates. |
| Standard system and home Unity `.ulf` license-file globs | Zero matches. Only names/presence checked; no license contents read. |
| `dpkg-query` installed-state check for Unity, Mono runtime/GAC and .NET packages | No matching installed toolchain package. `mono-gac` reported `un`, meaning not installed. Similarly named font packages are irrelevant. |
| Repository `ProjectSettings/ProjectVersion.txt` and `Packages/manifest.json` markers, excluding generated/dependency directories | None found at check time. No existing pinned Unity Editor version was established. |

Installed software and entitlement are separate. Missing local license files do not establish whether the user has a Unity entitlement elsewhere. No account login, entitlement API query, activation, or licensing validation was attempted. No configured cloud secret or identity binding was reported; this also says nothing about the user's external account.

## Resources and platform

- Debian GNU/Linux 13.6, x86-64, glibc 2.41.
- Four CPU cores of cgroup quota (`cpu.max`: `400000 100000`); five CPUs visible to Python.
- 32 GiB cgroup memory limit; approximately 32.5 GiB host memory reported, approximately 31.8 GiB available; no swap.
- Approximately 59.7 GiB free on the workspace filesystem (64,124,420,096 bytes at inspection).

These are measured resources, not evidence of a supported Unity host. The current official Linux support matrix, graphics requirements, Editor/module size, and Windows cross-build support must be checked for the chosen release before installation. No GPU, display, or Editor runtime compatibility test ran. Do not infer Debian support from available disk and memory.

## Official route checks

Read the cloud-environment runtime skill and its networking reference, queried current `environment_status`, and read `/etc/codex/network-policy.json` before network requests. Observations were current, the environment was running/connected, and restricted HTTP policy was enforced. Unity destinations were absent from its effective allowed hosts. VPN was not configured.

Each URL below was checked with:

```sh
curl --head --silent --show-error --connect-timeout 8 --max-time 15 '<URL>'
```

Inherited HTTP/HTTPS proxy settings and CA trust were preserved; TLS verification remained enabled. No direct route, proxy bypass, alternate mirror, or certificate exception was used.

| Official URL | Result on permitted network execution |
| --- | --- |
| `https://unity.com/releases/editor/archive` | Proxy CONNECT HTTP 403; curl exit 56. |
| `https://public-cdn.cloud.unity3d.com/hub/prod/UnityHub.AppImage` | Proxy CONNECT HTTP 403; curl exit 56. |
| `https://services.api.unity.com/unity/editor/release/v1/releases?limit=1` | Proxy CONNECT HTTP 403; curl exit 56. |
| `https://download.unity3d.com/` | Proxy CONNECT HTTP 403; curl exit 56. |
| `https://packages.unity.com/` | Proxy CONNECT HTTP 403; curl exit 56. |
| `https://license.unity3d.com/` | Proxy CONNECT HTTP 403; curl exit 56. |

Initial sandboxed requests to the same six URLs returned curl exit 7 because the configured proxy could not be reached from that sandbox. Repeating through approved network execution reached the proxy and produced the explicit CONNECT denial above. These are fresh results, not an assumption from earlier failures. None reached the upstream Unity server, so they establish neither upstream availability nor account/license failure. A HEAD check of a service root would not by itself validate that service even if allowed.

## Smallest next unblock

1. Through the supported cloud environment configuration workflow, allow the six exact official destination hosts tested above. This document does not change policy. Read-only release/support documentation may additionally require `docs.unity3d.com`. Add any actual redirect, module CDN, or account/authentication host only after observing it in the official route; the six hosts are the smallest tested starting set, not a claim that they cover installation and licensing completely.
2. Repeat the bounded archive, release metadata, and Hub checks with the inherited proxy and normal TLS verification. Retrieve the current official Linux support requirements. Choose and record a concrete supported Unity LTS release and exact revision from that evidence. **No exact release/install command is recommended now because official metadata and host support could not be verified.** If this Debian environment is unsupported, use a supported Unity host rather than changing engines.
3. Once the route, host support, and license provisioning path are established, install the official Hub/Editor and only the PC target module required for the slice. Installation remains a separate next step; none was attempted here. User-owned sign-in/entitlement must use Unity's supported workflow, without invented license data or secrets in source control.
4. Establish the project version, then run a real batch-mode project import/compile with a normal activated license. Preserve the Editor log and exit status. Run the slice in Play Mode, produce the intended standalone PC build, and smoke-test that artifact on its target OS. Record which target and module were actually used. Until those checks run, continue reporting Unity build and gameplay validation as untested.

No repository source, dependencies, engine choice, or cloud configuration was changed by this preflight.

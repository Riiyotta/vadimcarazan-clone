#!/usr/bin/env python3
"""contentHash of the files the bound design policy is ENFORCED BY (registry.manifest.json designPolicy).

    python3 extraction/policy_hash.py            # --check (default): exit 1 if the manifest hash is stale
    python3 extraction/policy_hash.py --write    # write the recomputed hash into registry.manifest.json

Method (also recorded in the manifest as contentHashMethod): for each file in POLICY_FILES order, append
"<relative path>\\n<sha256 hex of the file bytes>\\n"; contentHash = "sha256:" + sha256 hex of that text.
The list is pinned here and must equal manifest designPolicy.contentHashFiles (verify_all checks both).
"""
import hashlib, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
POLICY_FILES = ["tokens/llm/token-policy.json", "compatibility/graph.json", "schema/pagespec.schema.json", "schema/semantic_validate.py"]


def compute(repo=REPO, files=POLICY_FILES):
    acc = []
    for rel in files:
        with open(os.path.join(repo, rel), "rb") as f:
            acc.append("%s\n%s\n" % (rel, hashlib.sha256(f.read()).hexdigest()))
    return "sha256:" + hashlib.sha256("".join(acc).encode("utf-8")).hexdigest()


def main(argv):
    path = os.path.join(REPO, "registry.manifest.json")
    with open(path, encoding="utf-8") as f:
        man = json.load(f)
    want = compute()
    if "--write" in argv:
        man["designPolicy"]["contentHash"] = want
        with open(path, "w", encoding="utf-8") as f:
            json.dump(man, f, indent=1, ensure_ascii=False)
            f.write("\n")
        print("wrote designPolicy.contentHash %s" % want)
        return 0
    got = man.get("designPolicy", {}).get("contentHash")
    print("policy contentHash %s" % ("matches" if got == want else "STALE: manifest %s, recomputed %s" % (got, want)))
    return 0 if got == want else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

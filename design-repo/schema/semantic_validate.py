#!/usr/bin/env python3
"""Semantic validator for PageSpecs: everything Draft-07 JSON Schema cannot express.

    python3 schema/semantic_validate.py <pagespec.json> [...]      # exit 1 on any error
    python3 schema/semantic_validate.py --examples                 # every example in schema/

Layers, in order:
  1. repo integrity pins (PIN_AVAILABILITY, PIN_RETRIEVAL): the registry files must agree with the tables
     pinned below, so editing assets/asset-roles.json, a contract, the allowlist or a template alone cannot
     loosen them;
  2. Draft-07 schema;
  3. template cross-reference: the declared template's REAL node list incl. the case-body slot
     (TEMPLATE_SEQUENCE, REQUIRED_SECTION_MISSING), ROUTE_PATTERN, ROUTE_TEMPLATE_MISMATCH, HOME_ROUTE_ONLY;
  4. compatibility graph rules (ids identical to compatibility/graph.json, checked by verify_all.py);
  5. per-field maxWords from the section contracts (MAX_WORDS);
  6. motion (MOTION_PATTERN_NOT_ALLOWED, MOTION_FALLBACK_MISMATCH);
  7. tokens against tokens/llm/token-catalog.json + token-policy.json (TOKEN_*);
  8. asset roles per field (ASSET_ROLE_NOT_ALLOWED) and, when mode == "generated", the source-identity rules
     GENERATED_MODE_{BRAND,PERSON,CLIENT,CONTACT,CTA,COPY,URL,STORE,RATING,MEDIA,ASSET}, driven by
     schema/protected-content.json (patterns grepped from the real source).
The repo root is derived from this file's location; no absolute path is used.
"""
import hashlib, json, re, sys
from pathlib import Path
from urllib.parse import urlparse

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent

# R3: availability pinned in code, independent of assets/asset-roles.json.
PINNED_AVAILABILITY = {
    "brand.logo-mark": "blocked-for-generation", "brand.name-lettering": "blocked-for-generation",
    "brand.signature-trace": "blocked-for-generation", "portrait.subject-photo": "blocked-for-generation",
    "work.piece-image": "reference-only", "work.piece-video": "reference-only", "font.display-original": "reference-only",
    "social.share-image-original": "reference-only",
    "generated.brand-mark": "generation-safe", "placeholder.brand-mark": "generation-safe", "generated.name-lettering": "generation-safe",
    "generated.signature": "generation-safe", "user.portrait-photo": "generation-safe", "generated.portrait-silhouette": "generation-safe",
    "generated.work-visual": "generation-safe", "user.work-media": "generation-safe", "placeholder.work-video": "generation-safe",
    "licensed-or-fallback.font": "generation-safe", "icon.ui": "generation-safe", "placeholder.url": "generation-safe",
    "original.copy": "generation-safe", "fictional.person": "generation-safe", "placeholder.metric": "generation-safe",
}
# Roles whose generation policy is pinned to one specific value (a real mark/likeness is never reusable).
PINNED_GENERATION_POLICY = {"brand.logo-mark": "must-not-reuse", "brand.name-lettering": "must-not-reuse", "brand.signature-trace": "must-not-reuse",
                            "portrait.subject-photo": "must-not-reuse", "work.piece-image": "must-not-reuse", "user.portrait-photo": "user-supplied-only"}
# R8: runtime/utility UI that is not retrievable, pinned in code.
RETRIEVAL_INELIGIBLE = {"shell.loader", "shell.phone-menu", "utility.fly-fades", "utility.flybar", "overlay.glass-box", "utility.hover-hud",
                        "utility.copy-toast", "utility.page-top-fade"}
RUNTIME_ID = re.compile(r"(^shell\.|^utility\.|^overlay\.|overlay|modal|dialog|drawer|menu|loader|preloader|toast|hud|cookie|consent|cursor|lightbox|fade|flybar)")
NON_CONTENT = {"SHELL", "UTILITY"}
RESERVED_HOST = re.compile(r"(^|\.)(example|invalid)$|^example\.(com|org|net)$")
MEDIA_SCHEMES = ("generated://", "placeholder://", "user://")
VIEW_SECTION = {"project": "detail.project-view", "selected": "index.selected-list", "about": "about.studio-bio", "contact": "conversion.brief-form"}

RULES = {  # graph rule ids -> severity; verify_all.py checks equality with compatibility/graph.json
    "ONE_HERO": "error", "HERO_FIRST_CONTENT": "error", "MUST_BE_FIRST": "error", "MUST_BE_LAST": "error", "ONE_PER_PAGE": "error",
    "REQUIRES_SECTION": "error", "TEMPLATE_ONLY": "error", "ROUTE_PATTERN": "error", "HOME_ROUTE_ONLY": "error", "BOX_VIEWS_MATCH": "error",
    "NAV_TARGET_EXISTS": "error", "NEXT_CASE_NOT_SELF": "error", "RETRIEVAL_INELIGIBLE_SHELL_ONLY": "error",
    "NO_ADJACENT_SAME_CATEGORY": "warn", "NO_CONSECUTIVE_DUPLICATE": "warn", "CASE_BODY_HAS_TEXT": "warn", "MOTION_BUDGET": "warn",
}


def _j(p):
    return json.loads(Path(p).read_text())


def load_repo(root=ROOT):
    root = Path(root)
    return {
        "root": root,
        "schema": _j(root / "schema/pagespec.schema.json"),
        "contracts": {p.stem: _j(p) for p in sorted((root / "sections").glob("*.json"))},
        "templates": _j(root / "templates/templates.json")["templates"],
        "routes": _j(root / "templates/routes.json")["routes"],
        "graph": _j(root / "compatibility/graph.json"),
        "catalog": _j(root / "tokens/llm/token-catalog.json")["tokens"],
        "policy": _j(root / "tokens/llm/token-policy.json"),
        "allowlist": _j(root / "tokens/llm/component-allowlist.json"),
        "roles": _j(root / "assets/asset-roles.json")["roles"],
        "protected": _j(root / "schema/protected-content.json"),
        "motion": _j(root / "tokens/00-foundation/motion-patterns.json")["patterns"],
    }


def repo_integrity(repo):
    """Pins that every validation run re-asserts against the registry files."""
    errs = []
    roles = repo["roles"]
    if set(roles) != set(PINNED_AVAILABILITY):
        errs.append(("PIN_AVAILABILITY", f"asset roles {sorted(set(roles) ^ set(PINNED_AVAILABILITY))} differ from the pinned table"))
    for r, av in PINNED_AVAILABILITY.items():
        if r in roles and roles[r].get("availability") != av:
            errs.append(("PIN_AVAILABILITY", f"{r}: registry says {roles[r].get('availability')!r}, pinned {av!r}"))
    for r, pol in PINNED_GENERATION_POLICY.items():
        if r in roles and roles[r].get("generationPolicy") != pol:
            errs.append(("PIN_AVAILABILITY", f"{r}: generationPolicy {roles[r].get('generationPolicy')!r}, pinned {pol!r}"))
    for r, d in roles.items():
        if d.get("availability") != "generation-safe":
            subs = d.get("generationSafeSubstitutes") or []
            if not subs or any(PINNED_AVAILABILITY.get(s) != "generation-safe" for s in subs):
                errs.append(("PIN_AVAILABILITY", f"{r}: needs generationSafeSubstitutes that are generation-safe"))
    for sid, c in repo["contracts"].items():
        for name, role in _field_gen_roles(c["content"]):
            if PINNED_AVAILABILITY.get(role) != "generation-safe":
                errs.append(("PIN_AVAILABILITY", f"{sid}.{name}: generatedAssetRoles lists {role} which is not generation-safe"))
    false_set = {sid for sid, c in repo["contracts"].items() if c.get("retrievalEligible") is False}
    if false_set != RETRIEVAL_INELIGIBLE:
        errs.append(("PIN_RETRIEVAL", f"contracts with retrievalEligible:false {sorted(false_set)} != pinned {sorted(RETRIEVAL_INELIGIBLE)}"))
    for sid, c in repo["contracts"].items():
        if RUNTIME_ID.search(sid) and sid not in RETRIEVAL_INELIGIBLE:
            errs.append(("PIN_RETRIEVAL", f"{sid} looks like runtime UI but is not in RETRIEVAL_INELIGIBLE"))
        if c.get("retrievalEligible") is False and len(c.get("retrievalReason", "")) < 30:
            errs.append(("PIN_RETRIEVAL", f"{sid}: retrievalReason must be >= 30 chars"))
        if c.get("retrievalEligible") is False and c["semantic"]["category"] not in NON_CONTENT:
            errs.append(("RETRIEVAL_INELIGIBLE_SHELL_ONLY", f"{sid}: content category {c['semantic']['category']} cannot be ineligible"))
        a = repo["allowlist"]["sections"].get(sid)
        if a is not None and a.get("retrievalEligible") != (sid not in RETRIEVAL_INELIGIBLE):
            errs.append(("PIN_RETRIEVAL", f"allowlist {sid}.retrievalEligible disagrees with the pin"))
    for t, tpl in repo["templates"].items():
        for n in tpl["nodes"]:
            if "section" in n and n.get("retrievalEligible") != (n["section"] not in RETRIEVAL_INELIGIBLE):
                errs.append(("PIN_RETRIEVAL", f"template {t} node {n['section']} retrievalEligible disagrees with the pin"))
    return errs


# ------------------------------------------------------------------ helpers
def _field_gen_roles(fields, prefix=""):
    for name, f in fields.items():
        for r in f.get("generatedAssetRoles", []):
            yield prefix + name, r
        if f["kind"] in ("items", "group"):
            yield from _field_gen_roles(f["fields"], prefix + name + ".")


def words(s):
    return len(re.findall(r"\S+", s))


def walk_strings(obj, path=""):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, f"{path}[{i}]")


def walk_media(obj, path=""):
    if isinstance(obj, dict):
        if "assetRole" in obj and "ref" in obj:
            yield path, obj
        for k, v in obj.items():
            yield from walk_media(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_media(v, f"{path}[{i}]")


def check_words(fields, content, path, errs):
    for name, f in fields.items():
        if name not in content:
            continue
        v, k, p = content[name], f["kind"], f"{path}.{name}"
        if k == "text" and isinstance(v, str) and words(v) > f["maxWords"]:
            errs.append(("MAX_WORDS", f"{p}: {words(v)} words > {f['maxWords']}"))
        elif k == "textList" and isinstance(v, list):
            for i, s in enumerate(v):
                if isinstance(s, str) and words(s) > f["maxWords"]:
                    errs.append(("MAX_WORDS", f"{p}[{i}]: {words(s)} words > {f['maxWords']}"))
        elif k == "link" and isinstance(v, dict) and words(v.get("label", "")) > f["maxWords"]:
            errs.append(("MAX_WORDS", f"{p}.label: {words(v['label'])} words > {f['maxWords']}"))
        elif k == "linkList" and isinstance(v, list):
            for i, l in enumerate(v):
                if isinstance(l, dict) and words(l.get("label", "")) > f["maxWords"]:
                    errs.append(("MAX_WORDS", f"{p}[{i}].label: {words(l['label'])} words > {f['maxWords']}"))
        elif k in ("media", "mediaList"):
            for i, m in enumerate(v if isinstance(v, list) else [v]):
                if isinstance(m, dict) and words(m.get("alt", "")) > 40:
                    errs.append(("MAX_WORDS", f"{p}[{i}].alt: {words(m['alt'])} words > 40"))
        elif k == "items" and isinstance(v, list):
            for i, it in enumerate(v):
                if isinstance(it, dict):
                    check_words(f["fields"], it, f"{p}[{i}]", errs)
        elif k == "group" and isinstance(v, dict):
            check_words(f["fields"], v, p, errs)


def field_roles(fields, content, out, path=""):
    """(field path, media object, reference roles, generated roles) for every media value, by contract field kind."""
    for name, f in fields.items():
        if name not in content:
            continue
        v = content[name]
        if f["kind"] in ("media", "mediaList"):
            for m in (v if isinstance(v, list) else [v]):
                if isinstance(m, dict):
                    out.append((path + name, m, f["assetRoles"], f["generatedAssetRoles"]))
        elif f["kind"] == "items" and isinstance(v, list):
            for it in v:
                if isinstance(it, dict):
                    field_roles(f["fields"], it, out, path + name + ".")
        elif f["kind"] == "group" and isinstance(v, dict):
            field_roles(f["fields"], v, out, path + name + ".")


def term_re(term, cs=False):
    return re.compile(r"(?<![\w])" + re.escape(term) + r"(?![\w])", 0 if cs else re.I)


_cache = {}


def compiled(repo):
    key = id(repo["protected"])
    if key in _cache:
        return _cache[key]
    pats = repo["protected"]["sourceBrand"]["patterns"]
    c = {}
    for g, d in pats.items():
        if g in ("COPY", "URL", "MEDIA"):
            continue
        c[g] = [term_re(t) for t in d.get("terms", [])] + [term_re(t, True) for t in d.get("caseSensitiveTerms", [])] + [re.compile(r) for r in d.get("regex", [])]
    for g, d in repo["protected"].get("genericGuards", {}).items():
        c.setdefault(g, [])
        c[g] += [term_re(t) for t in d.get("terms", [])] + [re.compile(r) for r in d.get("regex", [])]
    c["COPY_PHRASES"] = [term_re(p) for p in pats["COPY"]["phrases"]]
    c["SHINGLES"] = set(pats["COPY"]["shingleHashes"]); c["SH"] = pats["COPY"]["shingleSize"]
    c["URL_DOMAINS"] = [d.lower() for d in pats["URL"]["domains"]]
    c["MEDIA"] = [re.compile(r) for r in pats["MEDIA"]["regex"]]
    _cache[key] = c
    return c


def norm(s):
    s = s.lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"[^a-z0-9à-öø-ÿ']+", " ", s).strip()


def url_strings(spec):
    for p, s in walk_strings({"brand": spec.get("brand"), "nodes": spec.get("nodes")}):
        if re.match(r"(?i)^(https?://|mailto:|tel:|www\.|//)", s.strip()) or p.endswith(".href") or p == "brand.domain":
            yield p, s.strip()


GROUP_RULE = (("BRAND", "GENERATED_MODE_BRAND"), ("PERSON", "GENERATED_MODE_PERSON"), ("CLIENT", "GENERATED_MODE_CLIENT"), ("CONTACT", "GENERATED_MODE_CONTACT"),
              ("CTA", "GENERATED_MODE_CTA"), ("STORE", "GENERATED_MODE_STORE"), ("RATING", "GENERATED_MODE_RATING"))
SKIP_PATH = re.compile(r"(\.section|\.pattern|\.reducedMotionFallback|\.assetRole|\.ref|\.surface|\.text|\.spaceBlock|\.font|\.action|\.views\[\d+\]|\.labelSource|\.visibleWhen|\.delivery)$")


def generated_mode(spec, repo, errs):
    c = compiled(repo)
    texts = [(p, s) for p, s in walk_strings({"meta": spec.get("meta"), "brand": spec.get("brand"), "nodes": spec.get("nodes")}) if not SKIP_PATH.search(p) and ".tokens." not in p]

    def joined(o, path):  # copy split across list items (name lines, lead pieces) is also checked joined
        if isinstance(o, list):
            if len(o) > 1 and all(isinstance(x, str) for x in o):
                yield path + "[joined]", " ".join(o)
            for i, x in enumerate(o):
                yield from joined(x, f"{path}[{i}]")
        elif isinstance(o, dict):
            parts = [o[k]["label"] if isinstance(o.get(k), dict) and "label" in o[k] else o.get(k) for k in ("leadText", "leadLink", "leadTail")]
            if all(isinstance(x, str) for x in parts):
                yield path + ".lead[joined]", " ".join(parts)
            for k, v in o.items():
                yield from joined(v, f"{path}.{k}")
    texts += list(joined(spec.get("nodes", []), "nodes"))
    for p, s in texts:
        for group, code in GROUP_RULE:
            hit = next((r.pattern for r in c.get(group, []) if r.search(s)), None)
            if hit:
                errs.append((code, f"{p}: source {group.lower()} pattern {hit!r} in {s[:60]!r}"))
        if any(r.search(s) for r in c["COPY_PHRASES"]):
            errs.append(("GENERATED_MODE_COPY", f"{p}: source phrase in {s[:60]!r}"))
        else:
            w = norm(s).split()
            for i in range(0, len(w) - c["SH"] + 1):
                if hashlib.sha1(" ".join(w[i:i + c["SH"]]).encode()).hexdigest()[:16] in c["SHINGLES"]:
                    errs.append(("GENERATED_MODE_COPY", f"{p}: shares a {c['SH']}-word window with source copy: {' '.join(w[i:i + c['SH']])!r}"))
                    break
        low = s.lower()
        for d in c["URL_DOMAINS"]:
            if d in low:
                errs.append(("GENERATED_MODE_URL", f"{p}: source URL/domain {d!r}"))
                break
    for p, s in url_strings(spec):
        low = s.lower()
        if low.startswith(("#", "?")) or (low.startswith("/") and not low.startswith("//")):
            continue
        if low.startswith("tel:"):
            errs.append(("GENERATED_MODE_CONTACT", f"{p}: phone links are not part of this source's vocabulary")); continue
        if low.startswith("mailto:"):
            host = low.split("@")[-1].split("?")[0]
        elif p == "brand.domain":
            host = low
        else:
            host = urlparse(s if "://" in s else "https://" + s.lstrip("/")).hostname or ""
        if not RESERVED_HOST.search(host):
            errs.append(("GENERATED_MODE_URL", f"{p}: {s!r} is not on a reserved domain (.example/.invalid/example.com)"))
    for p, m in walk_media(spec.get("nodes", [])):
        role, ref = m.get("assetRole"), m.get("ref", "")
        if PINNED_AVAILABILITY.get(role) != "generation-safe":
            errs.append(("GENERATED_MODE_ASSET", f"nodes{p}: role {role!r} is {PINNED_AVAILABILITY.get(role)} (not generation-safe)"))
        if not ref.startswith(MEDIA_SCHEMES) or any(r.search(ref) for r in c["MEDIA"]):
            errs.append(("GENERATED_MODE_MEDIA", f"nodes{p}: ref {ref!r} must be generated://, placeholder:// or user:// and not a source asset"))


def match_template(spec, repo, errs):
    tpl = repo["templates"].get(spec["template"])
    nodes = spec["nodes"]; i = 0
    for t in tpl["nodes"]:
        if "slot" in t:
            n0 = i
            while i < len(nodes) and nodes[i]["section"] in t["allowed"]:
                i += 1
            cnt = i - n0
            if cnt < t.get("minItems", 0) or cnt > t.get("maxItems", 10 ** 6):
                errs.append(("TEMPLATE_SEQUENCE", f"slot {t['slot']}: {cnt} nodes, allowed {t.get('minItems', 0)}-{t.get('maxItems')}"))
            continue
        if i < len(nodes) and nodes[i]["section"] == t["section"]:
            i += 1
            while t.get("repeatable") and i < len(nodes) and nodes[i]["section"] == t["section"]:
                i += 1
        elif t.get("required"):
            errs.append(("REQUIRED_SECTION_MISSING", f"template {spec['template']} requires {t['section']} at this position (found {nodes[i]['section'] if i < len(nodes) else 'end of page'})"))
    if i < len(nodes):
        errs.append(("TEMPLATE_SEQUENCE", f"node[{i}] {nodes[i]['section']} is not allowed at this position by template {spec['template']}"))


def check_tokens(i, n, spec, repo, errs):
    cat, pol, con = repo["catalog"], repo["policy"], repo["contracts"][n["section"]]
    t = n.get("tokens") or {}
    raw_color = re.compile(pol["rawValueRestrictions"]["color"]["regex"])
    raw_space = re.compile(pol["rawValueRestrictions"]["spacing"]["regex"])
    for field, v in t.items():
        want = pol["pageSpecTokenFields"][field]["category"]
        p = f"nodes[{i}].tokens.{field}"
        if raw_color.search(v) and v not in cat:
            errs.append(("TOKEN_RAW_COLOR", f"{p}: raw colour {v!r}; use a catalog token")); continue
        if field == "spaceBlock" and raw_space.match(v):
            errs.append(("TOKEN_ARBITRARY_SPACING", f"{p}: arbitrary spacing {v!r}; use a space.* token")); continue
        if field == "font" and v not in pol["fontFamilyAllowed"]:
            errs.append(("TOKEN_FONT_UNSUPPORTED", f"{p}: font {v!r} not in {pol['fontFamilyAllowed']}")); continue
        if v not in cat:
            errs.append(("TOKEN_UNKNOWN", f"{p}: {v!r} not in token-catalog")); continue
        if cat[v]["category"] != want:
            errs.append(("TOKEN_CATEGORY", f"{p}: {v!r} is {cat[v]['category']}, field needs {want}")); continue
        if not cat[v].get("pageSpecReferenceable"):
            errs.append(("TOKEN_NOT_REFERENCEABLE", f"{p}: {v!r} is not PageSpec-referenceable"))
    surf, text = t.get("surface"), t.get("text")
    if surf and surf in cat:
        if surf not in pol["themes"].get(spec["theme"], []):
            errs.append(("TOKEN_THEME_COMBINATION", f"nodes[{i}]: surface {surf!r} not defined in theme {spec['theme']!r}"))
        if surf not in con["tokens"]["surfaces"]:
            errs.append(("TOKEN_SURFACE_NOT_ALLOWED", f"nodes[{i}] {n['section']}: surface {surf!r} not in {con['tokens']['surfaces']}"))
    eff = surf or (con["tokens"]["surfaces"][0] if con["tokens"]["surfaces"] else None)
    if text and text in cat and eff and text not in pol["surfaceTextPairs"].get(eff, []):
        errs.append(("TOKEN_THEME_COMBINATION", f"nodes[{i}]: text {text!r} on {eff!r} is not an approved pair"))


def validate(spec, repo=None):
    """Return (errors, warnings); each a list of (code, message)."""
    repo = repo or load_repo()
    errs, warns = list(repo_integrity(repo)), []
    try:
        from jsonschema import Draft7Validator
    except ImportError:
        return errs + [("SCHEMA", "jsonschema is required (pip install jsonschema)")], warns
    se = sorted(Draft7Validator(repo["schema"]).iter_errors(spec), key=lambda e: list(e.absolute_path))
    for e in se:
        errs.append(("SCHEMA", f"{'/'.join(map(str, e.absolute_path))}: {e.message[:160]}"))
    if se:
        return errs, warns
    C, nodes, mode = repo["contracts"], spec["nodes"], spec["mode"]
    tpl = repo["templates"][spec["template"]]
    if not re.match(tpl["routePattern"], spec["route"]):
        errs.append(("ROUTE_PATTERN", f"route {spec['route']} does not match {tpl['routePattern']} of {spec['template']}"))
    routes = {r["path"]: r for r in repo["routes"]}
    if mode == "reference":
        r = routes.get(spec["route"])
        if not r or r["template"] != spec["template"]:
            errs.append(("ROUTE_TEMPLATE_MISMATCH", f"route {spec['route']} is mapped to {r['template'] if r else 'nothing'}, spec says {spec['template']}"))
        if spec["template"] == "cosmos-home" and spec["route"] not in [p for p, x in routes.items() if x["template"] == "cosmos-home"]:
            errs.append(("HOME_ROUTE_ONLY", f"cosmos-home template used on {spec['route']}"))
    match_template(spec, repo, errs)
    cats = [C[n["section"]]["semantic"]["category"] for n in nodes]
    present = [n["section"] for n in nodes]
    if cats.count("HERO") != 1:
        errs.append(("ONE_HERO", f"{cats.count('HERO')} HERO nodes"))
    content_idx = [k for k, c in enumerate(cats) if c not in NON_CONTENT]
    if content_idx and cats[content_idx[0]] != "HERO":
        errs.append(("HERO_FIRST_CONTENT", f"first content node is {nodes[content_idx[0]]['section']}"))
    counts = {}
    for k, n in enumerate(nodes):
        sid, con = n["section"], C[n["section"]]
        counts[sid] = counts.get(sid, 0) + 1
        cs = con.get("constraints", {})
        if cs.get("mustBeFirst") and k != 0:
            errs.append(("MUST_BE_FIRST", f"{sid} must be the first node"))
        if cs.get("mustBeLast") and k != len(nodes) - 1:
            errs.append(("MUST_BE_LAST", f"{sid} must be the last node"))
        if cs.get("templates") and spec["template"] not in cs["templates"]:
            errs.append(("TEMPLATE_ONLY", f"{sid} only allowed in {cs['templates']}"))
        for req in cs.get("requires", []):
            if req not in present:
                errs.append(("REQUIRES_SECTION", f"{sid} requires {req}"))
        if "retrievalEligible" in n and n["retrievalEligible"] != con["retrievalEligible"]:
            errs.append(("RETRIEVAL_INELIGIBLE_SHELL_ONLY", f"nodes[{k}] {sid}: retrievalEligible {n['retrievalEligible']} contradicts the contract/pin"))
        if n.get("retrievalEligible") is False and sid not in RETRIEVAL_INELIGIBLE:
            errs.append(("RETRIEVAL_INELIGIBLE_SHELL_ONLY", f"nodes[{k}] {sid}: a content section cannot be marked ineligible"))
        check_words(con["content"], n["content"], f"nodes[{k}].content", errs)
        m = n["motion"]
        if m["pattern"] not in con["motion"]["allowed"]:
            errs.append(("MOTION_PATTERN_NOT_ALLOWED", f"nodes[{k}] {sid}: {m['pattern']!r} not in {con['motion']['allowed']}"))
        exp = repo["motion"].get(m["pattern"], {}).get("reducedMotionFallback")
        if m["reducedMotionFallback"] != exp:
            errs.append(("MOTION_FALLBACK_MISMATCH", f"nodes[{k}] {sid}: fallback for {m['pattern']} must be {exp!r}"))
        check_tokens(k, n, spec, repo, errs)
        pairs = []
        field_roles(con["content"], n["content"], pairs)
        for name, mobj, ref_roles, gen_roles in pairs:
            role = mobj.get("assetRole")
            allowed = set(gen_roles) if mode == "generated" else set(ref_roles) | set(gen_roles)
            if role not in allowed:
                errs.append(("ASSET_ROLE_NOT_ALLOWED", f"nodes[{k}] {sid}.{name}: role {role!r} not allowed here in {mode} mode (allowed {sorted(allowed)})"))
        if sid == "overlay.glass-box":
            want = {v for v, s in VIEW_SECTION.items() if s in present}
            if set(n["content"]["views"]) != want:
                errs.append(("BOX_VIEWS_MATCH", f"glass box views {sorted(n['content']['views'])} != view sections present {sorted(want)}"))
        if sid in ("chrome.topbar", "shell.phone-menu") and spec["template"] == "cosmos-home":
            for it in n["content"].get("navItems", n["content"].get("links", [])):
                a = it.get("action")
                if a in VIEW_SECTION and VIEW_SECTION[a] not in present:
                    errs.append(("NAV_TARGET_EXISTS", f"nodes[{k}] {sid}: action {a!r} but {VIEW_SECTION[a]} is not on the page"))
        if sid == "index.next-case":
            h = n["content"]["href"]
            if not re.match(r"^/work/[a-z0-9-]+$", h) or h == spec["route"]:
                errs.append(("NEXT_CASE_NOT_SELF", f"next-case href {h!r} must be another /work/<slug> route"))
    for sid, cnt in counts.items():
        cs = C[sid].get("constraints", {})
        if (cs.get("onePerPage") and cnt > 1) or ("maxPerPage" in cs and cnt > cs["maxPerPage"]):
            errs.append(("ONE_PER_PAGE", f"{sid} appears {cnt} times"))
    g = {r["id"]: r for r in repo["graph"]["rules"]}
    exc = g["NO_ADJACENT_SAME_CATEGORY"].get("exceptions", [])
    exempt = set(g["NO_CONSECUTIVE_DUPLICATE"].get("exemptSections", []))
    for k in range(1, len(nodes)):
        a, b = nodes[k - 1], nodes[k]
        if cats[k - 1] == cats[k] and not any(e.get("categories") == [cats[k - 1], cats[k]] for e in exc):
            warns.append(("NO_ADJACENT_SAME_CATEGORY", f"{a['section']} -> {b['section']} ({cats[k]})"))
        if a["section"] == b["section"] and a["section"] not in exempt:
            warns.append(("NO_CONSECUTIVE_DUPLICATE", f"{a['section']} twice in a row"))
    if spec["template"] == "case-study" and "editorial.case-text" not in present:
        warns.append(("CASE_BODY_HAS_TEXT", "case body has no editorial.case-text"))
    amb = g["MOTION_BUDGET"]
    n_amb = sum(1 for n in nodes if n["motion"]["pattern"] in amb["ambient"])
    if n_amb > amb["max"]:
        warns.append(("MOTION_BUDGET", f"{n_amb} ambient-loop nodes > {amb['max']}"))
    if mode == "generated":
        generated_mode(spec, repo, errs)
    return errs, warns


def example_paths(root=ROOT):
    return [Path(root) / "schema/example.pagespec.json"] + sorted((Path(root) / "schema/examples").glob("*.json"))


def main(argv):
    paths = example_paths() if argv[1:] == ["--examples"] else [Path(a) for a in argv[1:]]
    if not paths:
        print(__doc__); return 2
    repo = load_repo(); bad = 0
    for p in paths:
        spec = json.loads(Path(p).read_text())
        e, w = validate(spec, repo)
        try:
            name = Path(p).resolve().relative_to(ROOT)
        except ValueError:
            name = p
        print(f"{'PASS' if not e else 'FAIL'}  {name}  mode={spec.get('mode')} template={spec.get('template')}  errors={len(e)} warnings={len(w)}")
        for code, msg in e:
            print(f"   ERROR {code}: {msg}")
        for code, msg in w:
            print(f"   warn  {code}: {msg}")
        bad += bool(e)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

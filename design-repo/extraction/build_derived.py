#!/usr/bin/env python3
"""Regenerate the DERIVED files of this design-repo from its source-of-truth files.

    python3 extraction/build_derived.py

Source of truth (hand-maintained)        ->  derived (written here, never hand-edited)
  sections/*.json content contracts      ->  schema/pagespec.schema.json (per-section content branches)
  assets/asset-roles.json                ->  schema/pagespec.schema.json assetRole enum
  tokens/00-foundation/motion-patterns   ->  schema/pagespec.schema.json motion enums
  templates/templates.json               ->  schema/pagespec.schema.json template enum
  tokens/00..30/*.json + token-policy    ->  tokens/llm/token-catalog.json
  sections, primitives, components       ->  tokens/llm/component-allowlist.json
  asset roles + motion patterns          ->  schema/section-contract.schema.json (closed contract schema)
extraction/verify_all.py re-derives the same things and FAILS on any drift, so editing a derived file by
hand (or a source file without re-running this) is caught.
"""
import json, sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
ALLOWLIST_VERSION = "1.0.0"
PAGESPEC_VERSION = "1.0.0"


def j(rel):
    return json.loads((ROOT / rel).read_text())


def w(rel, obj):
    (ROOT / rel).write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n")


def field_schema(f):
    k = f["kind"]
    if k == "text":
        return {"type": "string", "minLength": 1}
    if k == "textList":
        return {"type": "array", "minItems": f["minItems"], "maxItems": f["maxItems"], "items": {"type": "string", "minLength": 1}}
    if k == "link":
        return {"$ref": "#/definitions/link"}
    if k == "linkList":
        return {"type": "array", "minItems": f["minItems"], "maxItems": f["maxItems"], "items": {"$ref": "#/definitions/link"}}
    if k == "media":
        return {"$ref": "#/definitions/media"}
    if k == "mediaList":
        return {"type": "array", "minItems": f["minItems"], "maxItems": f["maxItems"], "items": {"$ref": "#/definitions/media"}}
    if k == "items":
        return {"type": "array", "minItems": f["minItems"], "maxItems": f["maxItems"], "items": object_schema(f["fields"])}
    if k == "group":
        return object_schema(f["fields"])
    if k == "enum":
        return {"enum": f["values"]}
    if k == "enumList":
        return {"type": "array", "minItems": f["minItems"], "maxItems": f["maxItems"], "uniqueItems": True, "items": {"enum": f["values"]}}
    if k == "boolean":
        return {"type": "boolean"}
    raise SystemExit(f"unknown field kind {k}")


def object_schema(fields):
    return {"type": "object", "additionalProperties": False, "required": sorted(n for n, f in fields.items() if f["required"]),
            "properties": {n: field_schema(f) for n, f in fields.items()}}


def contracts():
    return {p.stem: json.loads(p.read_text()) for p in sorted((ROOT / "sections").glob("*.json"))}


def build_schema():
    C = contracts()
    roles = j("assets/asset-roles.json")["roles"]
    mp = j("tokens/00-foundation/motion-patterns.json")
    tpl = j("templates/templates.json")["templates"]
    defs = {
        "link": {"type": "object", "additionalProperties": False, "required": ["label", "href"], "properties": {"label": {"type": "string", "minLength": 1}, "href": {"type": "string", "minLength": 1}}},
        "media": {"type": "object", "additionalProperties": False, "required": ["assetRole", "ref", "alt"], "properties": {"assetRole": {"enum": sorted(roles)}, "ref": {"type": "string", "minLength": 1}, "alt": {"type": "string"}}},
        "tokens": {"type": "object", "additionalProperties": False, "properties": {k: {"type": "string", "minLength": 1} for k in ("surface", "text", "spaceBlock", "font")}},
        "motion": {"type": "object", "additionalProperties": False, "required": ["pattern", "reducedMotionFallback"],
                   "properties": {"pattern": {"enum": sorted(mp["patterns"])}, "reducedMotionFallback": {"enum": mp["fallbackEnum"]}}},
    }
    for sid, c in C.items():
        defs["content." + sid] = object_schema(c["content"])
    defs["node"] = {"type": "object", "additionalProperties": False, "required": ["section", "content", "motion"],
                    "properties": {"section": {"enum": list(C)}, "content": {"type": "object"}, "tokens": {"$ref": "#/definitions/tokens"},
                                   "motion": {"$ref": "#/definitions/motion"}, "retrievalEligible": {"type": "boolean"}},
                    "allOf": [{"if": {"properties": {"section": {"const": sid}}}, "then": {"properties": {"content": {"$ref": f"#/definitions/content.{sid}"}}}} for sid in C]}
    return {
        "$schema": "http://json-schema.org/draft-07/schema#", "$id": "design-repo/schema/pagespec.schema.json", "title": "PageSpec",
        "description": "A page composed from this design-repo. mode=reference reconstructs the reference build faithfully; mode=generated builds a new page for someone else and must contain no source identity or content (schema/semantic_validate.py GENERATED_MODE_* rules). DERIVED by extraction/build_derived.py - do not hand-edit.",
        "type": "object", "additionalProperties": False,
        "required": ["pageSpecVersion", "mode", "template", "route", "locale", "theme", "meta", "brand", "nodes"],
        "properties": {
            "pageSpecVersion": {"const": PAGESPEC_VERSION},
            "mode": {"enum": ["reference", "generated"]},
            "template": {"enum": list(tpl)},
            "route": {"type": "string", "pattern": "^/"},
            "locale": {"enum": ["en"]},
            "theme": {"enum": ["dark"]},
            "meta": {"type": "object", "additionalProperties": False, "required": ["title", "description"], "properties": {"title": {"type": "string", "minLength": 1}, "description": {"type": "string", "minLength": 1}}},
            "brand": {"type": "object", "additionalProperties": False, "required": ["ownerName", "studioName", "domain"],
                      "properties": {"ownerName": {"type": "string", "minLength": 1}, "studioName": {"type": "string", "minLength": 1}, "domain": {"type": "string", "minLength": 1}}},
            "nodes": {"type": "array", "minItems": 1, "items": {"$ref": "#/definitions/node"}},
        },
        "definitions": defs,
    }


TOKEN_FILES = ["tokens/10-semantic/semantic.json", "tokens/20-component/component.json", "tokens/30-layout/layout.json"]


def token_files():
    out = []
    for f in sorted((ROOT / "tokens/00-foundation").glob("*.json")):
        if f.name != "motion-patterns.json":
            out.append(str(f.relative_to(ROOT)))
    return out + TOKEN_FILES


def build_catalog():
    pol = j("tokens/llm/token-policy.json")
    ref = set(pol["pageSpecReferenceable"])
    toks = {}
    for rel in token_files():
        for tid, t in j(rel)["tokens"].items():
            toks[tid] = {"category": t["category"], "value": t["$value"], "file": rel, "pageSpecReferenceable": tid in ref}
    return {"version": "1.0.0", "derivedFrom": token_files() + ["tokens/llm/token-policy.json (pageSpecReferenceable)"],
            "note": "DERIVED by extraction/build_derived.py; verify_all.py re-derives it and fails on any drift (missing, extra or changed token). Values trace to src/index.css / src/case.css via each token's evidence.",
            "counts": {"total": len(toks), "pageSpecReferenceable": sum(1 for t in toks.values() if t["pageSpecReferenceable"])}, "tokens": toks}


def build_allowlist():
    C = contracts()
    return {"version": ALLOWLIST_VERSION,
            "note": "DERIVED by extraction/build_derived.py. The closed list of what a generator may compose and set. verify_all.py checks parity both ways with the contract files and the schema node properties.",
            "nodeProperties": ["section", "content", "tokens", "motion", "retrievalEligible"],
            "sections": {sid: {"category": c["semantic"]["category"], "contentFields": sorted(c["content"]), "variants": c["variants"], "motion": c["motion"]["allowed"], "retrievalEligible": c["retrievalEligible"]} for sid, c in C.items()},
            "primitives": sorted(json.loads(p.read_text())["id"] for p in (ROOT / "primitives").glob("*.json")),
            "components": sorted(json.loads(p.read_text())["id"] for p in (ROOT / "components").glob("*.json"))}


CATEGORIES = ["SHELL", "UTILITY", "HERO", "SHOWCASE", "MEDIA", "GALLERY", "DETAIL", "INDEX", "ABOUT", "EDITORIAL", "CTA", "CONVERSION"]
FIELD_KINDS = ["text", "textList", "link", "linkList", "media", "mediaList", "items", "group", "enum", "enumList", "boolean"]


def build_contract_schema():
    roles = sorted(j("assets/asset-roles.json")["roles"])
    pats = sorted(j("tokens/00-foundation/motion-patterns.json")["patterns"])
    cite = {"type": "object", "additionalProperties": False, "required": ["cite", "needle"], "properties": {"cite": {"type": "string", "pattern": "^.+:[0-9]+(-[0-9]+)?$"}, "needle": {"type": "string", "minLength": 1}}}
    field = {"type": "object", "additionalProperties": False, "required": ["kind", "required"],
             "properties": {"kind": {"enum": FIELD_KINDS}, "required": {"type": "boolean"}, "maxWords": {"type": "integer", "minimum": 1}, "minItems": {"type": "integer", "minimum": 0},
                            "maxItems": {"type": "integer", "minimum": 1}, "assetRoles": {"type": "array", "items": {"enum": roles}}, "generatedAssetRoles": {"type": "array", "items": {"enum": roles}},
                            "values": {"type": "array", "minItems": 1, "items": {"type": "string"}}, "fields": {"type": "object", "additionalProperties": {"$ref": "#/definitions/field"}}},
             "allOf": [{"if": {"properties": {"kind": {"enum": ["text", "textList", "link", "linkList"]}}}, "then": {"required": ["maxWords"]}},
                       {"if": {"properties": {"kind": {"enum": ["media", "mediaList"]}}}, "then": {"required": ["assetRoles", "generatedAssetRoles"]}},
                       {"if": {"properties": {"kind": {"enum": ["items", "group"]}}}, "then": {"required": ["fields"]}},
                       {"if": {"properties": {"kind": {"enum": ["enum", "enumList"]}}}, "then": {"required": ["values"]}}]}
    return {"$schema": "http://json-schema.org/draft-07/schema#", "title": "Section contract", "description": "Closed schema for sections/*.json. DERIVED by extraction/build_derived.py (enums from assets/asset-roles.json and motion-patterns.json).",
            "type": "object", "additionalProperties": False,
            "required": ["id", "title", "version", "purpose", "semantic", "source", "implementedBy", "iaSectionId", "retrievalEligible", "constraints", "variants", "content", "motion", "tokens", "responsive", "referenceAssetRoles", "generatedAssetRoles", "measured", "evidence"],
            "definitions": {"cite": cite, "field": field},
            "properties": {
                "id": {"type": "string", "pattern": "^[a-z]+\\.[a-z0-9-]+$"}, "title": {"type": "string", "minLength": 1}, "version": {"type": "string"}, "purpose": {"type": "string", "minLength": 20},
                "semantic": {"type": "object", "additionalProperties": False, "required": ["id", "category"], "properties": {"id": {"type": "string"}, "category": {"enum": CATEGORIES}}},
                "source": {"type": "object", "additionalProperties": False, "required": ["id", "file", "tag", "lines", "needle"],
                           "properties": {"id": {"type": "string", "pattern": "^dom:"}, "file": {"type": "string"}, "tag": {"type": "string"}, "lines": {"type": "string", "pattern": "^[0-9]+(-[0-9]+)?$"}, "needle": {"type": "string", "minLength": 3}}},
                "implementedBy": {"type": "array", "minItems": 1, "items": {"$ref": "#/definitions/cite"}},
                "iaSectionId": {"type": ["string", "null"]},
                "retrievalEligible": {"type": "boolean"}, "retrievalReason": {"type": "string", "minLength": 30},
                "constraints": {"type": "object", "additionalProperties": False, "properties": {"onePerPage": {"type": "boolean"}, "maxPerPage": {"type": "integer"}, "mustBeFirst": {"type": "boolean"}, "mustBeLast": {"type": "boolean"},
                                                                                              "requires": {"type": "array", "items": {"type": "string"}}, "templates": {"type": "array", "items": {"type": "string"}}}},
                "variants": {"type": "array", "items": {"type": "string"}},
                "content": {"type": "object", "additionalProperties": {"$ref": "#/definitions/field"}},
                "motion": {"type": "object", "additionalProperties": False, "required": ["allowed", "default"], "properties": {"allowed": {"type": "array", "minItems": 1, "items": {"enum": pats}}, "default": {"enum": pats}}},
                "tokens": {"type": "object", "additionalProperties": False, "required": ["surfaces", "text"], "properties": {"surfaces": {"type": "array", "items": {"type": "string"}}, "text": {"type": "array", "items": {"type": "string"}}}},
                "responsive": {"type": "object", "additionalProperties": False, "required": ["phoneMaxWidth", "changes", "cite"], "properties": {"phoneMaxWidth": {"const": 860}, "changes": {"type": "array", "items": {"type": "string"}}, "cite": {"$ref": "#/definitions/cite"}, "measured390": {"type": "string"}}},
                "layer": {"type": "object", "additionalProperties": False, "required": ["position"], "properties": {"position": {"const": "fixed"}, "zIndex": {"type": "string"}, "parent": {"type": "string"}}},
                "referenceAssetRoles": {"type": "array", "items": {"enum": roles}}, "generatedAssetRoles": {"type": "array", "items": {"enum": roles}},
                "measured": {"type": "object"}, "evidence": {"type": "array", "items": {"$ref": "#/definitions/cite"}}},
            "allOf": [{"if": {"properties": {"retrievalEligible": {"const": False}}}, "then": {"required": ["retrievalReason"]}}]}


def main():
    w("schema/pagespec.schema.json", build_schema())
    w("tokens/llm/token-catalog.json", build_catalog())
    w("tokens/llm/component-allowlist.json", build_allowlist())
    w("schema/section-contract.schema.json", build_contract_schema())
    print("derived: schema/pagespec.schema.json, schema/section-contract.schema.json, tokens/llm/token-catalog.json, tokens/llm/component-allowlist.json")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate one Mermaid ER diagram per Prisma schema.

Reads services/*/prisma/schema.prisma and writes docs/diagramas/er-<service>.mmd.
This is the source used by the AS-BUILT architecture document; it reflects the
schema files, not an idealized model.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVICES = ROOT / "services"
OUT = ROOT / "docs" / "diagramas"

MODEL_RE = re.compile(r"^model\s+(\w+)\s*\{")
FIELD_RE = re.compile(r"^(\w+)\s+([A-Za-z_]\w*(?:\[\])?)(\?)?\s*(.*)$")
RELATION_RE = re.compile(r"@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*\)")
RELATION_REF_RE = re.compile(r"references:\s*\[([^\]]+)\]")

# Shared UUID keys that are not Prisma relations because the tables live in
# different bounded contexts. They are drawn as logical links, not FKs.
LOGICAL_RELATIONS = {
    "rate-availability": [
        ("Inventory", "Rate", "room_type_id (lógica)"),
        ("Inventory", "RateRule", "room_type_id (lógica)"),
    ],
}

TYPE_MAP = {
    "String": "string",
    "Int": "int",
    "BigInt": "bigint",
    "Float": "float",
    "Decimal": "decimal",
    "Boolean": "boolean",
    "DateTime": "timestamp",
    "Json": "json",
    "Bytes": "bytes",
}


def service_name(path: Path) -> str:
    name = path.parent.parent.name
    return name[:-8] if name.endswith("-service") else name


def parse_schema(path: Path) -> tuple[dict[str, list[dict]], set[str]]:
    models: dict[str, list[dict]] = {}
    model_names: set[str] = set()
    current: str | None = None

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        match = MODEL_RE.match(line)
        if match:
            current = match.group(1)
            models[current] = []
            model_names.add(current)
            continue
        if current is None:
            continue
        if line.startswith("}"):
            current = None
            continue
        if not line or line.startswith("//") or line.startswith("@@"):
            continue
        field = FIELD_RE.match(line)
        if not field:
            continue
        name, field_type, optional, attrs = field.groups()
        models[current].append(
            {
                "name": name,
                "type": field_type,
                "optional": optional == "?",
                "attrs": attrs,
            }
        )
    return models, model_names


def mermaid_type(field_type: str) -> str:
    is_list = field_type.endswith("[]")
    base = TYPE_MAP.get(field_type.removesuffix("[]"), "string")
    return f"{base}_list" if is_list else base


def build(service: str, models: dict[str, list[dict]], names: set[str]) -> str:
    lines = [
        "%% Generado por docs/tools/er_from_prisma.py — no editar a mano.",
        f"%% Fuente: services/{service}-service/prisma/schema.prisma",
        "erDiagram",
    ]

    fk_fields: set[tuple[str, str]] = set()
    relations: list[str] = []

    for model, fields in models.items():
        relation_fields = [
            f for f in fields if f["type"].removesuffix("[]").removesuffix("?") in names
        ]
        for rel in relation_fields:
            match = RELATION_RE.search(rel["attrs"])
            if not match:
                continue
            fk_names = [x.strip() for x in match.group(1).split(",")]
            for fk in fk_names:
                fk_fields.add((model, fk))
            target = rel["type"].removesuffix("[]").removesuffix("?")
            unique_fk = any(
                (
                    f["name"] in fk_names
                    and ("@unique" in f["attrs"] or "@id" in f["attrs"])
                )
                for f in fields
            )
            optional_fk = any(
                (f["name"] in fk_names and f["optional"]) for f in fields
            )
            ref = RELATION_REF_RE.search(rel["attrs"])
            label = fk_names[0] if len(fk_names) == 1 else ", ".join(fk_names)
            if unique_fk:
                cardinality = "||--o|"
            elif optional_fk:
                cardinality = "|o--o{"
            else:
                cardinality = "||--o{"
            relation = f'  {target} {cardinality} {model} : "{label}"'
            if relation not in relations:
                relations.append(relation)

    for model, fields in models.items():
        lines.append(f"  {model} {{")
        for field in fields:
            if field["type"].removesuffix("[]").removesuffix("?") in names:
                continue
            keys: list[str] = []
            if "@id" in field["attrs"]:
                keys.append("PK")
            if (model, field["name"]) in fk_fields:
                keys.append("FK")
            if not keys and "@unique" in field["attrs"]:
                keys.append("UK")
            key = f" {', '.join(keys)}" if keys else ""
            lines.append(
                f"    {mermaid_type(field['type'])} {field['name']}{key}".rstrip()
            )
        lines.append("  }")

    for left, right, label in LOGICAL_RELATIONS.get(service, []):
        if left in names and right in names:
            relation = f'  {left} ||--o{{ {right} : "{label}"'
            if relation not in relations:
                relations.append(relation)

    if relations:
        lines.append("")
        lines.extend(relations)

    return "\n".join(lines) + "\n"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    generated = 0
    for schema in sorted(SERVICES.glob("*/prisma/schema.prisma")):
        service = service_name(schema)
        models, names = parse_schema(schema)
        target = OUT / f"er-{service}.mmd"
        target.write_text(build(service, models, names), encoding="utf-8", newline="\n")
        print(f"{target.relative_to(ROOT)} ({len(models)} modelos)")
        generated += 1
    print(f"{generated} diagramas ER generados")


if __name__ == "__main__":
    main()

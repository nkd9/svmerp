#!/usr/bin/env python3

import json
import re
import sys
import zlib
from pathlib import Path


PAGE_OBJECTS = [2, 31, 41, 51, 61, 72, 83, 93]
CONTENT_OBJECTS = {2: 30, 31: 40, 41: 50, 51: 60, 61: 71, 72: 82, 83: 92, 93: 105}
FONT_CMAP_OBJECTS = [(4, 1768), (8, 1772), (9, 1776), (10, 1780), (11, 1790), (12, 1795), (15, 1799)]


def parse_pdf_objects(pdf_bytes: bytes):
    pattern = re.compile(rb"(\d+) 0 obj(.*?)endobj", re.S)
    return {int(match.group(1)): match.group(2) for match in pattern.finditer(pdf_bytes)}


def get_stream(objects: dict[int, bytes], object_id: int) -> bytes:
    body = objects[object_id]
    match = re.search(rb"stream\r?\n(.*?)\r?\nendstream", body, re.S)
    if not match:
        return b""

    data = match.group(1)
    if b"/FlateDecode" in body:
        data = zlib.decompress(data)
    return data


def parse_cmap(data: bytes):
    text = data.decode("latin1", errors="ignore")
    cmap: dict[str, str] = {}
    code_width = 4

    code_space_match = re.search(r"begincodespacerange(.*?)endcodespacerange", text, re.S)
    if code_space_match:
        lengths = [len(start) for start, _ in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", code_space_match.group(1))]
        if lengths:
            code_width = max(lengths)

    for block in re.finditer(r"(\d+) beginbfchar(.*?)endbfchar", text, re.S):
        for src, dst in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block.group(2)):
            cmap[src.upper()] = bytes.fromhex(dst).decode("utf-16-be", errors="ignore")

    for block in re.finditer(r"(\d+) beginbfrange(.*?)endbfrange", text, re.S):
        for line in block.group(2).strip().splitlines():
            line = line.strip()

            range_match = re.match(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", line)
            if range_match:
                start_hex, end_hex, target_hex = range_match.groups()
                start = int(start_hex, 16)
                end = int(end_hex, 16)
                target = int(target_hex, 16)
                width = len(start_hex)
                for offset, code in enumerate(range(start, end + 1)):
                    cmap[f"{code:0{width}X}"] = bytes.fromhex(f"{target + offset:04X}").decode("utf-16-be", errors="ignore")
                continue

            array_match = re.match(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*?)\]", line)
            if array_match:
                start_hex, _, array_body = array_match.groups()
                start = int(start_hex, 16)
                width = len(start_hex)
                for offset, item_hex in enumerate(re.findall(r"<([0-9A-Fa-f]+)>", array_body)):
                    cmap[f"{start + offset:0{width}X}"] = bytes.fromhex(item_hex).decode("utf-16-be", errors="ignore")

    return cmap, code_width


def decode_hex(hex_text: str, font_info):
    cmap, code_width = font_info
    condensed = "".join(hex_text.split()).upper()
    return "".join(cmap.get(condensed[index : index + code_width], "") for index in range(0, len(condensed), code_width))


def build_page_fonts(objects: dict[int, bytes]):
    font_to_cmap = {str(font_id): parse_cmap(get_stream(objects, cmap_id)) for font_id, cmap_id in FONT_CMAP_OBJECTS}
    page_fonts: dict[int, dict[str, tuple[dict[str, str], int]]] = {}

    for page_object in PAGE_OBJECTS:
        body = objects[page_object]
        font_match = re.search(rb"/Font\s*<<(.*?)>>", body, re.S)
        fonts: dict[str, tuple[dict[str, str], int]] = {}
        if font_match:
            for name, object_id in re.findall(rb"/(F\d+)\s+(\d+)\s+0\s+R", font_match.group(1)):
                fonts[name.decode()[1:]] = font_to_cmap.get(str(int(object_id)), ({}, 4))
        page_fonts[page_object] = fonts

    return page_fonts


def extract_blocks(objects: dict[int, bytes], page_fonts, page_index: int, page_object: int):
    stream_text = get_stream(objects, CONTENT_OBJECTS[page_object]).decode("latin1", errors="ignore")
    blocks = []

    for match in re.finditer(r"BT(.*?)ET", stream_text, re.S):
        block = match.group(1)
        font_match = re.search(r"/F(\d+)\s+\d+(?:\.\d+)?\s+Tf", block)
        position_match = re.search(r"1 0 0 -1 ([\d.]+) ([\d.]+) Tm", block)
        if not font_match or not position_match:
            continue

        font_info = page_fonts[page_object].get(font_match.group(1), ({}, 4))
        decoded = "".join(decode_hex(hex_text, font_info) for hex_text in re.findall(r"<([^>]+)>\s*Tj", block)).strip()
        if not decoded:
            continue

        blocks.append(
            {
                "page": page_index,
                "x": float(position_match.group(1)),
                "y": float(position_match.group(2)),
                "text": decoded,
            }
        )

    return blocks


def clean_text(value: str):
    return re.sub(r"\s+", " ", value).strip().strip(":")


def extract_students(pdf_path: Path):
    pdf_bytes = pdf_path.read_bytes()
    objects = parse_pdf_objects(pdf_bytes)
    page_fonts = build_page_fonts(objects)

    all_blocks = []
    for page_index, page_object in enumerate(PAGE_OBJECTS, start=1):
        all_blocks.extend(extract_blocks(objects, page_fonts, page_index, page_object))

    serial_blocks = [
        block
        for block in all_blocks
        if abs(block["x"] - 24) < 1 and re.fullmatch(r"\d+", block["text"])
    ]
    serial_blocks.sort(key=lambda block: (block["page"], block["y"]))

    students = []

    for index, serial in enumerate(serial_blocks):
        next_serial = serial_blocks[index + 1] if index + 1 < len(serial_blocks) else None
        row_blocks = [
            block
            for block in all_blocks
            if block["page"] == serial["page"]
            and block["y"] >= serial["y"]
            and (next_serial is None or next_serial["page"] != serial["page"] or block["y"] < next_serial["y"])
        ]

        info_blocks = sorted([block for block in row_blocks if 60 <= block["x"] < 200], key=lambda block: (block["y"], block["x"]))
        parent_blocks = sorted([block for block in row_blocks if 230 <= block["x"] < 380], key=lambda block: (block["y"], block["x"]))
        address_blocks = sorted([block for block in row_blocks if 380 <= block["x"] < 515], key=lambda block: (block["y"], block["x"]))
        reg_blocks = sorted([block for block in row_blocks if 515 <= block["x"] < 760], key=lambda block: (block["y"], block["x"]))

        name_line = clean_text(" ".join(block["text"] for block in info_blocks if abs(block["y"] - serial["y"]) < 1))
        gender_match = re.search(r"\((Male|Female)\)", name_line)
        gender = gender_match.group(1) if gender_match else ""
        if gender_match:
            name_line = clean_text(name_line.replace(gender_match.group(0), ""))
        elif gender == "":
            extra_gender = " ".join(block["text"] for block in info_blocks if "(Male)" in block["text"] or "(Female)" in block["text"])
            extra_gender_match = re.search(r"\((Male|Female)\)", extra_gender)
            if extra_gender_match:
                gender = extra_gender_match.group(1)

        class_text = " ".join(block["text"] for block in info_blocks if "XII" in block["text"] or "Class" in block["text"])
        class_match = re.search(r":\s*([A-Z0-9 ]+)", class_text)

        student_code_text = " ".join(block["text"] for block in info_blocks if "Student Id" in block["text"])
        student_code_match = re.search(r"Student Id\s*:\s*([A-Z0-9]+)", student_code_text, re.I)

        dob_text = " ".join(block["text"] for block in info_blocks if "DOB" in block["text"])
        dob_match = re.search(r"DOB\s*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})", dob_text)

        parent_lines = []
        for y_value in sorted({round(block["y"]) for block in parent_blocks}):
            line = clean_text(" ".join(block["text"] for block in parent_blocks if round(block["y"]) == y_value))
            if line:
                parent_lines.append(line)

        phone_index = next((line_index for line_index, line in enumerate(parent_lines) if re.search(r"\b\d{10}\b", line)), None)
        father_name = clean_text(" ".join(parent_lines[:phone_index])) if phone_index is not None else clean_text(" ".join(parent_lines))
        phone = ""
        mother_name = ""
        if phone_index is not None:
            phone_match = re.search(r"(\d{10})", parent_lines[phone_index])
            phone = phone_match.group(1) if phone_match else ""
            mother_name = clean_text(" ".join(parent_lines[phone_index + 1 :]))

        reg_date_text = " ".join(block["text"] for block in address_blocks if "Reg.Date" in block["text"])
        reg_date_match = re.search(r"Reg.Date\s*([0-9]{2}/[0-9]{2}/[0-9]{4})", reg_date_text)

        reg_text = " ".join(block["text"] for block in reg_blocks)
        reg_match = re.search(r":\s*([A-Za-z]{2}\d+)", reg_text)

        students.append(
            {
                "serial": int(serial["text"]),
                "name": name_line,
                "gender": gender,
                "class_name": clean_text(class_match.group(1) if class_match else class_text.replace("Class", "")),
                "student_code": student_code_match.group(1).upper() if student_code_match else "",
                "dob": dob_match.group(1) if dob_match else "",
                "father_name": father_name,
                "phone": phone,
                "mother_name": mother_name,
                "reg_date": reg_date_match.group(1) if reg_date_match else "",
                "district": "Ganjam" if any("Ganjam" in block["text"] for block in address_blocks) else "",
                "reg_no": reg_match.group(1).upper() if reg_match else "",
            }
        )

    return students


def main():
    if len(sys.argv) < 2:
        print("Usage: extract_students_from_pdf.py <pdf-path>", file=sys.stderr)
        sys.exit(1)

    pdf_path = Path(sys.argv[1]).expanduser().resolve()
    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    students = extract_students(pdf_path)
    json.dump(students, sys.stdout, indent=2)


if __name__ == "__main__":
    main()

import json, subprocess, sys, os, re
pdf, qjson, outdir = sys.argv[1:4]
os.makedirs(outdir, exist_ok=True)
# (question, page, bbox in pt, where, anchor text in stem / option letter)
IMGS = [
    (96, 101, (31, 222, 564, 639), 'stem', 'several users:'),
    (253, 263, (31, 110, 476, 519), 'stem', 'attached to an IAM group.'),
    (253, 263, (31, 519, 338, 767), 'stem', 'attached to an IAM group.'),
    (423, 439, (31, 167, 334, 395), 'stem', 'permissions:'),
    (429, 445, (31, 20, 564, 512), 'stem', 'applied to the group.'),
    (477, 494, (31, 286, 464, 614), 'stem', 'access rules.'),
    (477, 494, (55, 652, 393, 817), 'opt', 'A'),
    (477, 495, (55, 23, 361, 176), 'opt', 'B'),
    (477, 495, (55, 184, 354, 340), 'opt', 'C'),
    (477, 495, (55, 348, 366, 504), 'opt', 'D'),
    (494, 513, (31, 20, 556, 544), 'stem', 'policy attached:'),
    (980, 1019, (46, 291, 564, 360), 'opt', 'C'),
    (980, 1019, (46, 392, 564, 471), 'opt', 'D'),
]
R = 150; k = R / 72
qs = json.load(open(qjson)); by = {q['id']: q for q in qs}
seen = {}
for qid, page, (x0, y0, x1, y1), where, anchor in IMGS:
    n = seen[qid] = seen.get(qid, 0) + 1
    name = f'q{qid}-{n}'
    subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-r', str(R), '-png', '-singlefile',
                    '-x', str(int(x0*k)), '-y', str(int(y0*k)), '-W', str(int((x1-x0)*k)), '-H', str(int((y1-y0)*k)),
                    pdf, os.path.join(outdir, name)], check=True)
    tag = f'[[img:{name}.png]]'
    q = by[qid]
    if where == 'stem':
        i = q['q'].index(anchor) + len(anchor)
        # place after any images already inserted at this anchor
        while q['q'][i:].lstrip('\n').startswith('[[img:'):
            i = q['q'].index(']]', i) + 2
        q['q'] = q['q'][:i] + '\n' + tag + '\n' + q['q'][i:].lstrip('\n')
    else:
        q['options'][anchor] = (q['options'][anchor] + '\n' + tag).strip()
json.dump(qs, open(qjson, 'w'), ensure_ascii=False)
print('done', seen)

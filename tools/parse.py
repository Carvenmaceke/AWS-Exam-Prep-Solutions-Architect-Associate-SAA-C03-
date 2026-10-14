import re, json, sys
src, out = sys.argv[1], sys.argv[2]
txt = open(src, encoding='utf-8').read()
parts = re.split(r'(?m)^\f?\s*Question:\s*(\d+)\s+CertyIQ\s*$', txt)
qs, problems = [], []
for i in range(1, len(parts), 2):
    num = int(parts[i]); body = parts[i+1].replace('\f', '\n')
    lines = body.split('\n')
    # strip trailing page junk lines like 'CertyIQ'
    # locate answer line
    ai = next((k for k,l in enumerate(lines) if re.match(r'^\s*Answer:', l)), None)
    if ai is None: problems.append((num,'noanswer')); continue
    ans = re.sub(r'\s','', lines[ai].split(':',1)[1])
    rest = lines[ai+1:]
    if not ans:
        while rest and not rest[0].strip(): rest = rest[1:]
        if rest and re.fullmatch(r'\s*[A-F]{1,6}\s*', rest[0]): ans = rest[0].strip(); rest = rest[1:]
    if not re.fullmatch(r'[A-F]{1,6}', ans): problems.append((num,'badans:'+ans)); continue
    # explanation
    exp = '\n'.join(rest)
    exp = re.sub(r'^\s*Explanation:\s*', '', exp.strip())
    # dedent + collapse
    elines = [l.strip() for l in exp.split('\n')]
    paras, cur = [], []
    def join(ls):
        out = ''
        for l in ls:
            if out.endswith('-') and re.search(r'https?://\S*-$', out): out += l  # URL wrapped across lines
            else: out = (out + ' ' + l).strip()
        return out
    for l in elines:
        if not l or l == 'CertyIQ':
            if cur: paras.append(join(cur)); cur=[]
        else:
            if cur and re.match(r'^(\d+\.|[•●▪◦-])\s', l): paras.append(join(cur)); cur=[]
            cur.append(l)
    if cur: paras.append(join(cur))
    paras = [p for p in paras if p != 'CertyIQ']
    cut = next((k for k, p in enumerate(paras) if p.startswith('Thank you')), None)  # end-of-document marketing page
    if cut is not None: paras = paras[:cut]
    # question + options
    qlines = [x.replace('\f','') for x in lines[:ai]]
    def split_opts(strict):
        opts, stem = [], []
        for l in qlines:
            m = re.match(r'^\s{0,6}([A-F])\.\s*(.*)$', l)
            if m and num == 125 and opts and m.group(1) == 'D' == opts[-1][0]:
                opts.append(['E', m.group(2).strip()]); continue  # source labels option E as a second "D."
            if m and (opts and ord(m.group(1)) == ord(opts[-1][0]) + 1 or not opts and (m.group(1) == 'A' or not strict)):
                opts.append([m.group(1), m.group(2).strip()]); continue
            s = l.strip()
            if not s: continue
            if opts: opts[-1][1] = (opts[-1][1] + ' ' + s).strip()
            else: stem.append(s)
        return opts, stem
    opts, stem = split_opts(True)
    if not opts: opts, stem = split_opts(False)  # e.g. Q868: the source has no option A
    if num == 756:  # source runs options B, C ("B."), D together on one line
        b = opts[1][1]; i = b.index(' B. Create a web'); j = b.index(' D.Create')
        opts[1:2] = [['B', b[:i].strip()], ['C', b[i+3:j].strip()], ['D', b[j+3:].strip()]]
    for o in opts: o[1] = o[1].replace('VPUpdate', 'VPC. Update')
    if len(opts) < 2: problems.append((num,'opts%d'%len(opts))); continue
    if any(c not in [o[0] for o in opts] for c in ans): problems.append((num,'ansnotinopts')); continue
    qs.append({'id': num, 'q': ''.join(x + ('\n' if re.search(r'[.?:)]$', x) else ' ') for x in stem).strip(), 'options': {o[0]: o[1] for o in opts},
               'answer': list(ans), 'explanation': paras})
json.dump(qs, open(out,'w'), ensure_ascii=False)
print(len(qs), 'parsed;', len(problems), 'problems'); print(problems[:40])

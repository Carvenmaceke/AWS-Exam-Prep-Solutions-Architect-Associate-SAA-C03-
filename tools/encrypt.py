"""Encrypt the question bank and exhibit images into data/bank.enc.js.

Usage: ACCESS_CODE=... python3 tools/encrypt.py questions.json img/ data/bank.enc.js

The site derives an AES-256-GCM key from the access code with PBKDF2-SHA256,
so the code itself is never stored in the repository. Letters are upper-cased
and anything other than A-Z / 0-9 is ignored, matching normCode() in app.js.
"""
import base64, json, os, re, sys
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ITERATIONS = 310000

def main():
    qjson, imgdir, out = sys.argv[1:4]
    code = re.sub(r'[^A-Z0-9]', '', os.environ['ACCESS_CODE'].upper())
    if len(code) < 20:
        sys.exit('ACCESS_CODE is too short')
    questions = json.load(open(qjson, encoding='utf-8'))
    images = {}
    for f in sorted(os.listdir(imgdir)):
        mime = 'image/jpeg' if f.endswith('.jpg') else 'image/png'
        images[f] = f'data:{mime};base64,' + base64.b64encode(open(os.path.join(imgdir, f), 'rb').read()).decode()
    plain = json.dumps({'questions': questions, 'images': images}, ensure_ascii=False, separators=(',', ':')).encode()

    salt, iv = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(code.encode())
    data = AESGCM(key).encrypt(iv, plain, None)
    b = lambda x: base64.b64encode(x).decode()
    payload = {'v': 1, 'iter': ITERATIONS, 'salt': b(salt), 'iv': b(iv), 'data': b(data)}
    with open(out, 'w') as fh:
        fh.write('// Encrypted SAA-C03 question bank. Unlocked in the browser with the access code.\n')
        fh.write('window.ENCRYPTED_BANK = ' + json.dumps(payload) + ';\n')
    print(f'{len(questions)} questions and {len(images)} images encrypted -> {out}')

if __name__ == '__main__':
    main()

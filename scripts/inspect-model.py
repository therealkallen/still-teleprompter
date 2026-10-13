"""Inspect ONNX metadata and initializer data types without installing extra packages."""
import collections
import hashlib
import json
import sys
from pathlib import Path

def varint(data, at):
    value = 0; shift = 0
    while True:
        byte = data[at]; at += 1; value |= (byte & 127) << shift
        if not byte & 128: return value,at
        shift += 7
        if shift > 63: raise ValueError('invalid protobuf varint')

def fields(data):
    at = 0
    while at < len(data):
        tag, at = varint(data,at); number,kind = tag >> 3,tag & 7
        if kind == 0: value,at = varint(data,at)
        elif kind in (1,5): size = 8 if kind == 1 else 4; value = data[at:at+size]; at += size
        elif kind == 2: size,at = varint(data,at); value = data[at:at+size]; at += size
        else: raise ValueError('unsupported protobuf wire type')
        yield number,value

path = Path(sys.argv[1]); data = path.read_bytes(); metadata = {}; types = collections.Counter()
for number,value in fields(memoryview(data)):
    if number == 14:
        entry = {n:bytes(v).decode('utf-8') for n,v in fields(value)}
        metadata[entry[1]] = entry[2]
    elif number == 7:
        for field,tensor in fields(value):
            if field == 5:
                dtype = next((v for n,v in fields(tensor) if n == 2),None)
                types[dtype] += 1
assert metadata.get('model_type') in ('sense_voice', 'sense_voice_ctc'), {k:v for k,v in metadata.items() if k not in ('neg_mean','inv_stddev')}
assert types[2] + types[3] > 0, f'No 8-bit quantized tensors found: {dict(types)}'
token_ids = [int(line.rsplit(maxsplit=1)[-1]) for line in (path.parent / 'tokens.txt').read_text(encoding='utf-8').splitlines() if line.strip()]
assert len(set(token_ids)) == int(metadata['vocab_size']) and min(token_ids) == 0 and max(token_ids) == len(token_ids)-1, 'Tokenizer vocabulary mismatch'
print(json.dumps({'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'metadata':{k:v for k,v in metadata.items() if len(v)<1000},'initializerTypes':dict(types),'tokenCount':len(token_ids)},ensure_ascii=False))

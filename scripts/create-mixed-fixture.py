"""Concatenate explicit local test WAV chunks to exercise language changes."""
import argparse
import wave
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('chinese')
parser.add_argument('english')
parser.add_argument('output')
args = parser.parse_args()
chunks = []
for filename in [args.chinese,args.english]:
    with wave.open(filename,'rb') as source:
        assert (source.getframerate(),source.getnchannels(),source.getsampwidth()) == (16000,1,2)
        data = source.readframes(source.getnframes())
        chunks.append(data[:32000*3])
output = Path(args.output); output.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(output),'wb') as target:
    target.setnchannels(1); target.setsampwidth(2); target.setframerate(16000)
    target.writeframes(chunks[0] + chunks[1] + chunks[0] + chunks[1])
print('Created alternating-language test fixture; this is not natural code-switching acceptance evidence.')

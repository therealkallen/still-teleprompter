"""Verify Still's real PCM pipe protocol using silence or an explicit local WAV."""
import argparse
import array
import json
import subprocess
import sys
import time
import wave
import ctypes
import threading
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--runtime', default='runtime')
parser.add_argument('--wav')
parser.add_argument('--show-text', action='store_true', help='Explicitly opt in to console transcript output')
args = parser.parse_args()
runtime = Path(args.runtime).resolve()
pcm, rate = array.array('f', [0.0] * 16000), 16000
if args.wav:
    with wave.open(args.wav, 'rb') as source:
        assert source.getsampwidth() == 2 and source.getnchannels() == 1, 'Use a mono PCM16 WAV'
        rate = source.getframerate()
        raw = array.array('h', source.readframes(source.getnframes()))
        pcm = array.array('f', (sample / 32768 for sample in raw))
windows = [pcm[i:i + rate * 4] for i in range(0, len(pcm), rate * 2) if len(pcm[i:i + rate * 4]) >= rate // 2]
payload = bytearray()
for sequence, samples in enumerate(windows, 1):
    payload.extend((json.dumps({'samples':len(samples), 'sampleRate':rate, 'sequence':sequence}) + '\n').encode())
    payload.extend(samples.tobytes())
payload.extend(b'{"cmd":"stop"}\n')
started = time.perf_counter()
class Memory(ctypes.Structure):
    _fields_ = [('cb',ctypes.c_ulong),('PageFaultCount',ctypes.c_ulong)] + [(name,ctypes.c_size_t) for name in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage']]
peak = [0]
process = subprocess.Popen([str(runtime / 'python/python.exe'), '-I', '-B', '-u', str(runtime / 'asr/worker.py'), str(runtime / 'asr')],
                           stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
def monitor():
    if sys.platform != 'win32':
        return
    query = ctypes.WinDLL('psapi').GetProcessMemoryInfo
    query.argtypes = [ctypes.c_void_p,ctypes.POINTER(Memory),ctypes.c_ulong]
    while process.poll() is None:
        memory = Memory(); memory.cb = ctypes.sizeof(memory)
        if query(int(process._handle), ctypes.byref(memory), memory.cb):
            peak[0] = max(peak[0],memory.WorkingSetSize)
        time.sleep(0.02)
watcher = threading.Thread(target=monitor,daemon=True); watcher.start()
try:
    output, error_output = process.communicate(payload,timeout=120)
except subprocess.TimeoutExpired:
    process.kill(); process.communicate(); raise
watcher.join(timeout=1)
messages = [json.loads(line) for line in output.decode('utf-8').splitlines()]
assert process.returncode == 0, error_output.decode('utf-8', errors='replace')
assert messages[0]['kind'] == 'ready', messages
transcripts = [m for m in messages if m['kind'] == 'transcript']
assert len(transcripts) == len(windows), messages
if args.wav:
    assert any(m['text'] for m in transcripts), 'Speech fixture returned no text'
summary = {'modelLoadMs': messages[0]['loadMs'], 'windows':len(windows),
           'inferenceMs':[m['inferenceMs'] for m in transcripts],
           'nonemptyWindows':sum(bool(m['text']) for m in transcripts),
           'wallSeconds':round(time.perf_counter() - started, 2), 'peakWorkerMiB':round(peak[0] / 1048576, 2)}
if args.show_text:
    summary['text'] = [m['text'] for m in transcripts]
print(json.dumps(summary, ensure_ascii=False))

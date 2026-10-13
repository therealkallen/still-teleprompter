"""Local SenseVoice worker. PCM travels through pipes; audio is never written to disk."""
import array
import json
import sys
import time
from pathlib import Path


def send(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


def read_exact(source, size):
    data = bytearray()
    while len(data) < size:
        chunk = source.read(size - len(data))
        if not chunk:
            raise EOFError("PCM pipe closed")
        data.extend(chunk)
    return data


def main():
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    try:
        from sherpa_onnx import OfflineRecognizer
        model = Path(sys.argv[1])
        started = time.perf_counter()
        recognizer = OfflineRecognizer.from_sense_voice(
            model=str(model / "model.int8.onnx"), tokens=str(model / "tokens.txt"),
            language="auto", use_itn=True, num_threads=2, provider="cpu", debug=False,
        )
        send({"kind": "ready", "loadMs": round((time.perf_counter() - started) * 1000)})
    except Exception as error:
        send({"kind": "error", "error": "SenseVoice initialization failed: " + str(error)})
        return 1
    source = sys.stdin.buffer
    while True:
        header = source.readline(4096)
        if not header:
            return 0
        try:
            request = json.loads(header)
            if request.get("cmd") == "stop":
                return 0
            size, rate = int(request["samples"]), int(request["sampleRate"])
            if not 8000 <= rate <= 192000 or not 0 < size <= rate * 4:
                raise ValueError("Invalid or oversized recognition window")
            pcm = array.array("f")
            pcm.frombytes(read_exact(source, size * 4))
            if sys.byteorder != "little":
                pcm.byteswap()
            started = time.perf_counter()
            stream = recognizer.create_stream()
            stream.accept_waveform(rate, pcm)
            recognizer.decode_stream(stream)
            send({"kind": "transcript", "text": stream.result.text[:4096],
                  "inferenceMs": round((time.perf_counter() - started) * 1000),
                  "sequence": request["sequence"]})
        except EOFError:
            return 0
        except Exception as error:
            send({"kind": "error", "error": "SenseVoice inference failed: " + str(error)})
            return 1


if __name__ == "__main__":
    raise SystemExit(main())

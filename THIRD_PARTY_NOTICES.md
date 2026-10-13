# Third-party notices

Still's original source code is licensed under [MIT](LICENSE). Dependencies and the bundled speech model retain their own licenses. Still's MIT license does not replace those terms.

## Speech model and runtime

- **SenseVoiceSmall**, by **FunAudioLLM / Alibaba Group**, is distributed as the sherpa-onnx multilingual ONNX conversion by **Fangjun Kuang / k2-fsa**. Original model: <https://huggingface.co/FunAudioLLM/SenseVoiceSmall>. Conversion: <https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17>. The weights and derived weights use the **FunASR Model Open Source License Agreement v1.1**; the included conversion license refers to the upstream FunASR license. Full terms are retained in [docs/licenses/runtime/sensevoice](docs/licenses/runtime/sensevoice). The bundled `model.int8.onnx` SHA-256 is `c71f0ce00bec95b07744e116345e33d8cbbe08cef896382cf907bf4b51a2cd51`.
- **sherpa-onnx 1.12.28**, k2-fsa: Apache-2.0, <https://github.com/k2-fsa/sherpa-onnx/tree/v1.12.28>. The bundled Python entry point exposes ASR only, omitting TTS and speaker-diarization entry points; native source and the upstream recognizer are unchanged, as recorded in `runtime/asr-build.json`.
- **ONNX Runtime 1.23.2**, Microsoft: MIT and included third-party notices, <https://github.com/microsoft/onnxruntime/tree/v1.23.2>.
- **CPython 3.11.9**, Python Software Foundation: Python license and included notices for its components, <https://github.com/python/cpython/tree/v3.11.9>.

The portable release includes the full runtime license texts in `runtime/licenses/`; the source repository retains corresponding copies in `docs/licenses/runtime/`. No voice recordings or personal scripts are included in the release.

## Application dependencies

[docs/THIRD-PARTY-LICENSES.txt](docs/THIRD-PARTY-LICENSES.txt) contains a versioned index and the full license/notice texts collected from installed production npm dependencies and the locked Windows Cargo dependency graph. Cargo build dependencies are included as well. Identical texts are stored once and referenced by each component.

For the unmodified MPL-2.0 `selectors` component, corresponding source is available from <https://crates.io/crates/selectors/0.36.1> and <https://github.com/servo/stylo/tree/635e1a19d02960588a00e189bd4bd5bdb150ec3d/selectors>. The component's source files remain under MPL-2.0; Still's original source remains MIT. Other crates' original sources are linked in the dependency index. Still does not modify npm or Cargo dependency source code.

To refresh the application notices after changing lockfiles, install the locked dependencies and run:

```powershell
node scripts/generate-notices.mjs
```

The generator uses local dependency files and the checked-in upstream license supplements in `docs/licenses/rust/`. It does not download model weights, install dependencies, or read application user data. License supplements retain their pinned source URLs in `docs/licenses/sources.json`.

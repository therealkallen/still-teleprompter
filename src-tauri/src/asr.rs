//! Shared microphone capture and a bounded, serial local inference pipeline.
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    collections::VecDeque,
    io::{BufRead, BufReader, Read, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

static NEXT_ID: AtomicU64 = AtomicU64::new(1);
struct Session {
    id: u64,
    stop: Arc<AtomicBool>,
    child: Arc<Mutex<Option<Child>>>,
    revision: Arc<AtomicU64>,
}
impl Session {
    fn stop(&self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Ok(mut child) = self.child.lock() {
            if let Some(process) = child.as_mut() {
                let _ = process.kill();
            }
        }
    }
}
#[derive(Default)]
pub struct AsrService(Mutex<Option<Session>>);
impl Drop for AsrService {
    fn drop(&mut self) {
        if let Ok(session) = self.0.lock() {
            if let Some(s) = session.as_ref() {
                s.stop();
            }
        }
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    runtime_path: String,
    model_path: String,
    device_id: String,
    window_ms: u32,
    interval_ms: u32,
}
#[derive(Serialize)]
pub struct InputDevice {
    id: String,
    name: String,
}

#[tauri::command]
pub async fn list_microphones() -> Result<Vec<InputDevice>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut result = vec![InputDevice {
            id: String::new(),
            name: "系统默认麦克风".into(),
        }];
        let devices = cpal::default_host()
            .input_devices()
            .map_err(|e| e.to_string())?;
        for (index, device) in devices.enumerate() {
            if let Ok(name) = device.name() {
                result.push(InputDevice {
                    id: format!("{index}:{name}"),
                    name,
                });
            }
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn runtime_directory(app: &tauri::AppHandle, options: &Options) -> Result<PathBuf, String> {
    if !options.runtime_path.trim().is_empty() {
        return Ok(PathBuf::from(options.runtime_path.trim()));
    }
    if let Some(path) = std::env::var_os("STILL_ASR_RUNTIME") {
        return Ok(PathBuf::from(path));
    }
    let beside_exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Missing executable directory")?
        .join("runtime");
    if beside_exe.join("python/python.exe").is_file() {
        return Ok(beside_exe);
    }
    let bundled = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("runtime");
    if bundled.join("python/python.exe").is_file() {
        return Ok(bundled);
    }
    if cfg!(debug_assertions) {
        return Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../runtime"));
    }
    Ok(bundled)
}

#[tauri::command]
pub async fn start_auto_follow(
    app: tauri::AppHandle,
    state: tauri::State<'_, AsrService>,
    options: Options,
) -> Result<u64, String> {
    if !(2000..=4000).contains(&options.window_ms) || !(500..=1500).contains(&options.interval_ms) {
        return Err("识别窗口或更新间隔无效。".into());
    }
    let runtime = runtime_directory(&app, &options)?;
    let model = if options.model_path.trim().is_empty() {
        std::env::var_os("STILL_ASR_MODEL")
            .map(PathBuf::from)
            .unwrap_or_else(|| runtime.join("asr"))
    } else {
        PathBuf::from(options.model_path.trim())
    };
    let python = runtime.join("python/python.exe");
    // Always use Still's protocol implementation, never execute a foreign worker.
    let worker = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../runtime/asr/worker.py")
    } else {
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("runtime/asr/worker.py")
    };
    for file in [
        &python,
        &worker,
        &model.join("model.int8.onnx"),
        &model.join("tokens.txt"),
    ] {
        if !file.is_file() {
            return Err(format!(
                "缺少本地语音资源：{}。请在自动跟读设置中指定运行库和模型目录。",
                file.display()
            ));
        }
    }
    let mut active = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(previous) = active.take() {
        previous.stop();
    }
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    let stop = Arc::new(AtomicBool::new(false));
    let child = Arc::new(Mutex::new(None));
    let revision = Arc::new(AtomicU64::new(0));
    *active = Some(Session {
        id,
        stop: stop.clone(),
        child: child.clone(),
        revision: revision.clone(),
    });
    thread::Builder::new()
        .name("still-asr".into())
        .spawn(move || {
            let outcome = run(
                &app, id, &stop, &child, &revision, &python, &worker, &model, &options,
            );
            if !stop.load(Ordering::SeqCst) {
                if let Err(error) = outcome {
                    emit(&app, id, json!({"kind":"error", "error": error}));
                }
            }
            if let Ok(mut process) = child.lock() {
                if let Some(mut p) = process.take() {
                    let _ = p.kill();
                    let _ = p.wait();
                }
            }
        })
        .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn stop_auto_follow(state: tauri::State<AsrService>, session_id: u64) -> Result<(), String> {
    let mut active = state.0.lock().map_err(|e| e.to_string())?;
    if active.as_ref().is_some_and(|s| s.id == session_id) {
        if let Some(session) = active.take() {
            session.stop();
        }
    }
    Ok(())
}
#[tauri::command]
pub fn reset_auto_follow(state: tauri::State<AsrService>, session_id: u64) -> Result<u64, String> {
    let active = state.0.lock().map_err(|e| e.to_string())?;
    let session = active
        .as_ref()
        .filter(|s| s.id == session_id)
        .ok_or("自动跟读已停止。请重新开始。")?;
    Ok(session.revision.fetch_add(1, Ordering::SeqCst) + 1)
}
fn emit(app: &tauri::AppHandle, id: u64, mut value: Value) {
    value["sessionId"] = json!(id);
    let _ = app.emit_to("main", "auto-follow-event", value);
}

struct AudioRing {
    samples: VecDeque<f32>,
    capacity: usize,
    total: u64,
    last_audio: Instant,
}
impl AudioRing {
    fn push(&mut self, samples: impl Iterator<Item = f32>) {
        for sample in samples {
            if self.samples.len() == self.capacity {
                self.samples.pop_front();
            }
            self.samples.push_back(if sample.is_finite() {
                sample.clamp(-1.0, 1.0)
            } else {
                0.0
            });
            self.total += 1;
        }
        self.last_audio = Instant::now();
    }
}
fn input_stream<T: cpal::SizedSample + cpal::Sample>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    ring: Arc<Mutex<AudioRing>>,
    failure: Arc<Mutex<Option<String>>>,
) -> Result<cpal::Stream, String>
where
    f32: cpal::FromSample<T>,
{
    let channels = usize::from(config.channels);
    device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                if let Ok(mut buffer) = ring.try_lock() {
                    buffer.push(data.chunks(channels).map(|frame| {
                        frame.iter().map(|v| v.to_sample::<f32>()).sum::<f32>() / channels as f32
                    }));
                }
            },
            move |error| {
                if let Ok(mut value) = failure.lock() {
                    *value = Some(error.to_string());
                }
            },
            None,
        )
        .map_err(|e| {
            format!("麦克风无法打开：{e}。请检查 Windows 麦克风权限、设备连接及独占模式。")
        })
}

#[allow(clippy::too_many_arguments)]
fn run(
    app: &tauri::AppHandle,
    id: u64,
    stop: &AtomicBool,
    child: &Mutex<Option<Child>>,
    revision: &AtomicU64,
    python: &PathBuf,
    worker: &PathBuf,
    model: &PathBuf,
    options: &Options,
) -> Result<(), String> {
    let mut command = Command::new(python);
    command
        .args(["-I", "-B", "-u"])
        .arg(worker)
        .arg(model)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let mut process = command
        .spawn()
        .map_err(|e| format!("本地语音引擎启动失败：{e}"))?;
    let mut input = process.stdin.take().ok_or("Missing ASR stdin")?;
    let output = process.stdout.take().ok_or("Missing ASR stdout")?;
    {
        let mut handle = child.lock().map_err(|e| e.to_string())?;
        if stop.load(Ordering::SeqCst) {
            let _ = process.kill();
            let _ = process.wait();
            return Ok(());
        }
        *handle = Some(process);
    }
    let (sender, receiver) = mpsc::sync_channel(1);
    thread::spawn(move || {
        let mut reader = BufReader::new(output);
        loop {
            // Bound output even if a runtime is broken.
            let mut line = String::new();
            match reader.by_ref().take(16384).read_line(&mut line) {
                Ok(0) | Err(_) => break,
                _ => {
                    if sender
                        .send(serde_json::from_str::<Value>(&line).map_err(|e| e.to_string()))
                        .is_err()
                    {
                        break;
                    }
                }
            }
        }
    });
    let ready = receiver
        .recv_timeout(Duration::from_secs(60))
        .map_err(|_| "语音模型加载超时或引擎退出。请检查本地资源。".to_owned())??;
    if ready["kind"] != "ready" {
        return Err(ready["error"]
            .as_str()
            .unwrap_or("ASR initialization failed")
            .to_owned());
    }
    if stop.load(Ordering::SeqCst) {
        return Ok(());
    }
    let host = cpal::default_host();
    let device = if options.device_id.is_empty() {
        host.default_input_device()
    } else {
        host.input_devices()
            .map_err(|e| e.to_string())?
            .enumerate()
            .find_map(|(i, device)| {
                (device
                    .name()
                    .ok()
                    .is_some_and(|name| format!("{i}:{name}") == options.device_id))
                .then_some(device)
            })
    }
    .ok_or("未找到选定麦克风。请重新连接设备，在设置中刷新并选择麦克风。")?;
    let supported = device
        .default_input_config()
        .map_err(|e| format!("无法读取麦克风配置：{e}"))?;
    let format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();
    let rate = config.sample_rate.0;
    if !(8000..=192000).contains(&rate) || config.channels == 0 {
        return Err("麦克风采样格式不受支持。".into());
    }
    let ring = Arc::new(Mutex::new(AudioRing {
        samples: VecDeque::with_capacity(rate as usize * 4),
        capacity: rate as usize * options.window_ms as usize / 1000,
        total: 0,
        last_audio: Instant::now(),
    }));
    let failure = Arc::new(Mutex::new(None));
    let stream = match format {
        cpal::SampleFormat::F32 => {
            input_stream::<f32>(&device, &config, ring.clone(), failure.clone())
        }
        cpal::SampleFormat::I16 => {
            input_stream::<i16>(&device, &config, ring.clone(), failure.clone())
        }
        cpal::SampleFormat::U16 => {
            input_stream::<u16>(&device, &config, ring.clone(), failure.clone())
        }
        cpal::SampleFormat::I32 => {
            input_stream::<i32>(&device, &config, ring.clone(), failure.clone())
        }
        _ => return Err("麦克风采样格式不受支持。请选择其他输入设备。".into()),
    }?;
    stream.play().map_err(|e| e.to_string())?;
    emit(app, id, ready);
    let mut sequence = 0u64;
    let mut last_total = 0;
    let mut last_decode = Instant::now();
    let mut observed_revision = revision.load(Ordering::SeqCst);
    while !stop.load(Ordering::SeqCst) {
        thread::sleep(Duration::from_millis(40));
        if let Some(error) = failure.lock().map_err(|e| e.to_string())?.take() {
            return Err(format!(
                "麦克风已断开或不可用：{error}。请检查设备后重新开始。"
            ));
        }
        let requested_revision = revision.load(Ordering::SeqCst);
        if requested_revision != observed_revision {
            let mut buffer = ring.lock().map_err(|e| e.to_string())?;
            buffer.samples.clear();
            last_total = buffer.total;
            observed_revision = requested_revision;
            last_decode = Instant::now();
            continue;
        }
        let (samples, total) = {
            let buffer = ring.lock().map_err(|e| e.to_string())?;
            if buffer.last_audio.elapsed() > Duration::from_secs(5) {
                return Err("麦克风停止传输。请重新连接或选择其他输入设备。".into());
            }
            if last_decode.elapsed() < Duration::from_millis(u64::from(options.interval_ms))
                || buffer.samples.len() < rate as usize
                || buffer.total == last_total
            {
                continue;
            }
            (
                buffer.samples.iter().copied().collect::<Vec<f32>>(),
                buffer.total,
            )
        };
        last_total = total;
        sequence += 1;
        let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
        let tail = &samples[samples.len().saturating_sub(rate as usize / 2)..];
        let tail_rms = (tail.iter().map(|s| s * s).sum::<f32>() / tail.len() as f32).sqrt();
        if rms < 0.002 || tail_rms < 0.002 {
            emit(
                app,
                id,
                json!({"kind":"silence", "sequence": sequence, "revision": observed_revision}),
            );
            last_decode = Instant::now();
            continue;
        }
        writeln!(
            input,
            "{}",
            json!({"samples": samples.len(), "sampleRate": rate, "sequence": sequence})
        )
        .map_err(|e| e.to_string())?;
        let bytes: Vec<u8> = samples.iter().flat_map(|s| s.to_le_bytes()).collect();
        input
            .write_all(&bytes)
            .and_then(|_| input.flush())
            .map_err(|e| e.to_string())?;
        let mut result = receiver
            .recv_timeout(Duration::from_secs(15))
            .map_err(|_| "语音识别超时或引擎退出。请重新开始。".to_owned())??;
        if result["kind"] == "error" {
            return Err(result["error"].as_str().unwrap_or("ASR failed").to_owned());
        }
        result["revision"] = json!(observed_revision);
        if !stop.load(Ordering::SeqCst) && observed_revision == revision.load(Ordering::SeqCst) {
            emit(app, id, result);
        }
        // No queued jobs: the next inference samples the newest bounded window.
        last_decode = Instant::now();
    }
    drop(stream);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "Requires an available microphone; captures two seconds only in memory"]
    fn shared_microphone_capture_smoke() {
        let host = cpal::default_host();
        let device_count = host.input_devices().expect("enumerate microphones").count();
        let device = host.default_input_device().expect("default microphone");
        let supported = device
            .default_input_config()
            .expect("microphone configuration");
        let format = supported.sample_format();
        let config: cpal::StreamConfig = supported.into();
        let rate = config.sample_rate.0 as usize;
        let ring = Arc::new(Mutex::new(AudioRing {
            samples: VecDeque::new(),
            capacity: rate * 3,
            total: 0,
            last_audio: Instant::now(),
        }));
        let failure = Arc::new(Mutex::new(None));
        let stream = match format {
            cpal::SampleFormat::F32 => {
                input_stream::<f32>(&device, &config, ring.clone(), failure.clone())
            }
            cpal::SampleFormat::I16 => {
                input_stream::<i16>(&device, &config, ring.clone(), failure.clone())
            }
            cpal::SampleFormat::U16 => {
                input_stream::<u16>(&device, &config, ring.clone(), failure.clone())
            }
            cpal::SampleFormat::I32 => {
                input_stream::<i32>(&device, &config, ring.clone(), failure.clone())
            }
            _ => panic!("unsupported microphone format"),
        }
        .expect("open shared input stream");
        stream.play().expect("start input");
        thread::sleep(Duration::from_secs(2));
        drop(stream);
        assert!(failure.lock().unwrap().is_none(), "microphone error");
        let buffer = ring.lock().unwrap();
        assert!(
            buffer.total >= rate as u64,
            "microphone did not send samples"
        );
        assert!(buffer.samples.len() <= buffer.capacity);
        println!(
            "shared_capture_ok devices={device_count} rate={rate} samples={} retained={}",
            buffer.total,
            buffer.samples.len()
        );
    }
    #[test]
    fn ring_remains_bounded_and_keeps_recent_audio() {
        let mut ring = AudioRing {
            samples: VecDeque::new(),
            capacity: 3,
            total: 0,
            last_audio: Instant::now(),
        };
        ring.push([0.1, 0.2, 0.3, 0.4, 0.5].into_iter());
        assert_eq!(
            ring.samples.iter().copied().collect::<Vec<_>>(),
            [0.3, 0.4, 0.5]
        );
        assert_eq!(ring.total, 5);
        ring.push([f32::NAN, 2.0].into_iter());
        assert_eq!(
            ring.samples.iter().copied().collect::<Vec<_>>(),
            [0.5, 0.0, 1.0]
        );
    }
}

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::WebviewWindow;

static READING_MODE: AtomicBool = AtomicBool::new(true);

#[derive(Clone, Serialize)]
pub struct CaptureStatus {
    pub state: &'static str,
    pub message: String,
}

#[cfg(windows)]
mod win {
    use super::*;
    use std::ffi::c_void;

    #[repr(C)]
    struct OsVersion {
        size: u32,
        major: u32,
        minor: u32,
        build: u32,
        platform: u32,
        service_pack: [u16; 128],
    }

    type SubclassProc = unsafe extern "system" fn(isize, u32, usize, isize, usize, usize) -> isize;

    #[link(name = "user32")]
    extern "system" {
        fn SetWindowDisplayAffinity(hwnd: isize, affinity: u32) -> i32;
        fn GetWindowDisplayAffinity(hwnd: isize, affinity: *mut u32) -> i32;
    }
    #[link(name = "ntdll")]
    extern "system" {
        fn RtlGetVersion(version: *mut OsVersion) -> i32;
    }
    #[link(name = "comctl32")]
    extern "system" {
        fn SetWindowSubclass(hwnd: isize, callback: SubclassProc, id: usize, data: usize) -> i32;
        fn DefSubclassProc(hwnd: isize, message: u32, wparam: usize, lparam: isize) -> isize;
        fn RemoveWindowSubclass(hwnd: isize, callback: SubclassProc, id: usize) -> i32;
    }

    unsafe extern "system" fn subclass(
        hwnd: isize,
        msg: u32,
        wp: usize,
        lp: isize,
        _: usize,
        _: usize,
    ) -> isize {
        // WM_MOUSEACTIVATE: allow mouse/wheel handling without taking the presenter app's focus.
        if msg == 0x0021 && READING_MODE.load(Ordering::Relaxed) {
            return 3; // MA_NOACTIVATE
        }
        if msg == 0x0082 {
            RemoveWindowSubclass(hwnd, subclass, 0x5354494c);
        }
        DefSubclassProc(hwnd, msg, wp, lp)
    }

    pub fn install(window: &WebviewWindow) -> Result<(), String> {
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as *mut c_void as isize;
        if unsafe { SetWindowSubclass(hwnd, subclass, 0x5354494c, 0) } == 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
        mode(window, true)
    }

    pub fn mode(window: &WebviewWindow, reading: bool) -> Result<(), String> {
        // Keep Tao's window flags in sync: it otherwise overwrites a directly set
        // WS_EX_NOACTIVATE when showing, restoring or changing the window state.
        window.set_focusable(!reading).map_err(|e| e.to_string())?;
        READING_MODE.store(reading, Ordering::Relaxed);
        Ok(())
    }

    pub fn apply(window: &WebviewWindow, enabled: bool) -> CaptureStatus {
        let fail = |message: String| CaptureStatus {
            state: "failed",
            message,
        };
        let hwnd = match window.hwnd() {
            Ok(hwnd) => hwnd.0 as *mut c_void as isize,
            Err(e) => return fail(e.to_string()),
        };
        if enabled {
            let mut version = OsVersion {
                size: std::mem::size_of::<OsVersion>() as u32,
                major: 0,
                minor: 0,
                build: 0,
                platform: 0,
                service_pack: [0; 128],
            };
            if unsafe { RtlGetVersion(&mut version) } < 0 {
                return fail("无法读取 Windows 版本，未确认捕获排除支持。".into());
            }
            if version.major < 10 || (version.major == 10 && version.build < 19041) {
                return CaptureStatus {
                    state: "unsupported",
                    message: "捕获排除需要 Windows 10 2004（19041）或更新版本。".into(),
                };
            }
        }
        let expected = if enabled { 0x11 } else { 0 };
        if unsafe { SetWindowDisplayAffinity(hwnd, expected) } == 0 {
            return fail(format!(
                "Windows 捕获设置失败：{}",
                std::io::Error::last_os_error()
            ));
        }
        let mut actual = 0;
        if unsafe { GetWindowDisplayAffinity(hwnd, &mut actual) } == 0 {
            return fail(format!(
                "无法确认捕获状态：{}",
                std::io::Error::last_os_error()
            ));
        }
        if actual != expected {
            return fail(format!(
                "Windows 返回捕获标记 {actual:#x}，预期为 {expected:#x}。"
            ));
        }
        CaptureStatus {
            state: if enabled { "enabled" } else { "disabled" },
            message: if enabled {
                "Windows 已接受并确认捕获排除。请在 Teams 和录屏软件中独立测试。"
            } else {
                "捕获排除已关闭，稿件可能出现在屏幕共享或录制中。"
            }
            .into(),
        }
    }
}

pub fn install(window: &WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    return win::install(window);
    #[cfg(not(windows))]
    {
        let _ = window;
        Ok(())
    }
}

#[tauri::command]
pub fn set_reading_mode(window: WebviewWindow, reading: bool) -> Result<(), String> {
    #[cfg(windows)]
    return win::mode(&window, reading);
    #[cfg(not(windows))]
    {
        let _ = window;
        READING_MODE.store(reading, Ordering::Relaxed);
        Ok(())
    }
}

#[tauri::command]
pub fn set_capture_protection(window: WebviewWindow, enabled: bool) -> CaptureStatus {
    #[cfg(windows)]
    return win::apply(&window, enabled);
    #[cfg(not(windows))]
    {
        let _ = (window, enabled);
        CaptureStatus {
            state: "unsupported",
            message: "捕获排除只支持 Windows 桌面应用。".into(),
        }
    }
}

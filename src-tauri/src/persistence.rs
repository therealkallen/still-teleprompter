use std::{fs, io::Write, path::PathBuf, sync::Mutex};
use tauri::Manager;

#[derive(Default)]
pub struct StorageLock(pub Mutex<()>);

fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("workspace.json"))
}

#[tauri::command]
pub fn load_workspace(
    app: tauri::AppHandle,
    lock: tauri::State<StorageLock>,
) -> Result<Option<serde_json::Value>, String> {
    let _guard = lock.0.lock().map_err(|e| e.to_string())?;
    let file = path(&app)?;
    let backup = file.with_extension("json.bak");
    let read = |p: &PathBuf| -> Result<serde_json::Value, String> {
        let bytes = fs::read(p).map_err(|e| e.to_string())?;
        serde_json::from_slice(&bytes).map_err(|e| format!("本地数据损坏：{e}"))
    };
    if file.exists() {
        // Report corruption instead of silently overwriting the only recoverable copy.
        return read(&file).map(Some);
    }
    if backup.exists() {
        return read(&backup).map(Some);
    }
    Ok(None)
}

#[tauri::command]
pub fn save_workspace(
    app: tauri::AppHandle,
    lock: tauri::State<StorageLock>,
    workspace: serde_json::Value,
) -> Result<(), String> {
    let _guard = lock.0.lock().map_err(|e| e.to_string())?;
    if workspace.get("version").and_then(|v| v.as_u64()) != Some(1) {
        return Err("不支持的数据版本，未覆盖本地文件。".into());
    }
    let bytes = serde_json::to_vec_pretty(&workspace).map_err(|e| e.to_string())?;
    if bytes.len() > 40 * 1024 * 1024 {
        return Err("稿件库超过 40 MB，请先导出并精简内容。".into());
    }
    let file = path(&app)?;
    let temp = file.with_extension("json.tmp");
    let backup = file.with_extension("json.bak");
    let mut writer = fs::File::create(&temp).map_err(|e| e.to_string())?;
    writer
        .write_all(&bytes)
        .and_then(|_| writer.sync_all())
        .map_err(|e| e.to_string())?;
    drop(writer);
    if file.exists() {
        if backup.exists() {
            fs::remove_file(&backup).map_err(|e| e.to_string())?;
        }
        fs::rename(&file, &backup).map_err(|e| e.to_string())?;
    }
    if let Err(e) = fs::rename(&temp, &file) {
        if backup.exists() {
            let _ = fs::rename(&backup, &file);
        }
        return Err(e.to_string());
    }
    Ok(())
}

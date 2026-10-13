use serde::{Deserialize, Serialize};
use std::{collections::HashSet, sync::Mutex};
use tauri::Emitter;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Clone, Deserialize, Serialize)]
pub struct Binding {
    pub action: String,
    pub shortcut: String,
}

#[derive(Serialize)]
pub struct Registration {
    pub action: String,
    pub shortcut: String,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct Hotkeys(pub Mutex<Vec<Shortcut>>);

fn parse(binding: &Binding) -> Result<Shortcut, String> {
    if !["up", "down", "previous", "next", "bookmark", "follow"].contains(&binding.action.as_str())
    {
        return Err("未知快捷键动作。".into());
    }
    // A meaningful modifier is required; Shift alone must never consume ordinary typing.
    if !binding.shortcut.split('+').any(|s| {
        matches!(
            s.trim().to_lowercase().as_str(),
            "ctrl" | "control" | "alt" | "super" | "meta" | "commandorcontrol"
        )
    }) {
        return Err("至少包含 Ctrl、Alt 或 Win 修饰键，避免拦截普通输入。".into());
    }
    binding
        .shortcut
        .parse::<Shortcut>()
        .map_err(|e| format!("快捷键格式无效：{e}"))
}

#[tauri::command]
pub fn configure_hotkeys(
    app: tauri::AppHandle,
    state: tauri::State<Hotkeys>,
    bindings: Vec<Binding>,
) -> Result<Vec<Registration>, String> {
    if bindings.len() > 6 {
        return Err("最多支持六个全局快捷键。".into());
    }
    let mut active = state.0.lock().map_err(|e| e.to_string())?;
    // Do not leave old bindings active while reporting that the user's new settings apply.
    for key in active.iter() {
        app.global_shortcut()
            .unregister(*key)
            .map_err(|e| e.to_string())?;
    }
    active.clear();
    let mut seen = HashSet::new();
    let mut results = Vec::new();
    for binding in bindings {
        let outcome = parse(&binding).and_then(|shortcut| {
            if !seen.insert(shortcut.id()) {
                return Err("快捷键重复，请选择不同组合。".into());
            }
            let action = binding.action.clone();
            app.global_shortcut()
                .on_shortcut(shortcut, move |app, _, event| {
                    if event.state() == ShortcutState::Pressed {
                        let _ = app.emit_to("main", "manual-action", &action);
                    }
                })
                .map_err(|e| format!("注册失败，可能已被其他应用占用：{e}"))?;
            active.push(shortcut);
            Ok(())
        });
        results.push(Registration {
            action: binding.action,
            shortcut: binding.shortcut,
            error: outcome.err(),
        });
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unmodified_typing_and_unknown_actions() {
        for key in ["A", "Shift+A", "ArrowDown"] {
            assert!(parse(&Binding {
                action: "down".into(),
                shortcut: key.into()
            })
            .is_err());
        }
        assert!(parse(&Binding {
            action: "down".into(),
            shortcut: "Ctrl+Alt+ArrowDown".into()
        })
        .is_ok());
        assert!(parse(&Binding {
            action: "unexpected".into(),
            shortcut: "Ctrl+Alt+A".into()
        })
        .is_err());
    }
}

/// Startup items manager — registry and shell:startup folder entries.
pub struct StartupManager;

impl StartupManager {
    pub fn new() -> Self {
        Self
    }

    pub async fn list_items(&self) -> Result<Vec<String>, crate::error::AppError> {
        tracing::info!("StartupManager::list_items (stub)");
        Ok(vec![])
    }

    pub async fn toggle_item(
        &self,
        _name: &str,
        _enable: bool,
    ) -> Result<(), crate::error::AppError> {
        tracing::info!("StartupManager::toggle_item (stub)");
        Ok(())
    }
}

impl Default for StartupManager {
    fn default() -> Self {
        Self::new()
    }
}

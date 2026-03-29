/// Developer tools cache cleaner — node_modules, cargo target, pip cache, etc.
pub struct DevCleaner;

impl DevCleaner {
    pub fn new() -> Self {
        Self
    }

    pub async fn scan(&self) -> Result<Vec<String>, crate::error::AppError> {
        tracing::info!("DevCleaner::scan (stub)");
        Ok(vec![])
    }

    pub async fn clean(&self, _tools: &[String]) -> Result<u64, crate::error::AppError> {
        tracing::info!("DevCleaner::clean (stub)");
        Ok(0)
    }
}

impl Default for DevCleaner {
    fn default() -> Self {
        Self::new()
    }
}

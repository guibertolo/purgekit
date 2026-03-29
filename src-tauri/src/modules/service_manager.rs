/// Windows service management module.
pub struct ServiceManager;

impl ServiceManager {
    pub fn new() -> Self {
        Self
    }

    pub async fn list_services(&self) -> Result<Vec<String>, crate::error::AppError> {
        tracing::info!("ServiceManager::list_services (stub)");
        Ok(vec![])
    }

    pub async fn toggle_service(
        &self,
        _name: &str,
        _enable: bool,
    ) -> Result<(), crate::error::AppError> {
        tracing::info!("ServiceManager::toggle_service (stub)");
        Ok(())
    }
}

impl Default for ServiceManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Windows Registry access abstraction.
pub struct RegistryClient;

impl RegistryClient {
    pub fn new() -> Self {
        Self
    }

    /// Read a string value from the registry.
    pub fn read_string(
        &self,
        _hive: &str,
        _path: &str,
        _key: &str,
    ) -> Result<String, crate::error::AppError> {
        tracing::info!("RegistryClient::read_string (stub)");
        Err(crate::error::AppError::NotFound(
            "Registry stub".to_string(),
        ))
    }
}

impl Default for RegistryClient {
    fn default() -> Self {
        Self::new()
    }
}

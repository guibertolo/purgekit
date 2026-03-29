/// Gaming mode — stop non-essential services and optimize for performance.
pub struct GamingMode {
    pub active: bool,
}

impl GamingMode {
    pub fn new() -> Self {
        Self { active: false }
    }

    pub async fn activate(&mut self) -> Result<(), crate::error::AppError> {
        tracing::info!("GamingMode::activate (stub)");
        self.active = true;
        Ok(())
    }

    pub async fn deactivate(&mut self) -> Result<(), crate::error::AppError> {
        tracing::info!("GamingMode::deactivate (stub)");
        self.active = false;
        Ok(())
    }
}

impl Default for GamingMode {
    fn default() -> Self {
        Self::new()
    }
}

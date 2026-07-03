pub mod commands;
pub mod config;
pub mod error;
pub mod logging;
pub mod modules;
pub mod platform;
pub mod session;
pub mod state;

use std::sync::Arc;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 1. Resolve data directory (portable vs installed)
    let data_dir = config::resolve_data_dir();

    // 2. Initialize persistent file logging
    logging::init_logging(&data_dir);

    tracing::info!("PurgeKit starting — data dir: {}", data_dir.display());
    tracing::info!("Portable mode: {}", config::is_portable());

    // 3. Load config from disk (or defaults)
    let config_path = config::config_path(&data_dir);
    let mut app_config = config::AppConfig::load(&config_path);
    app_config.portable_mode = config::is_portable();

    // Save config to ensure the file exists on first run
    if let Err(e) = app_config.save(&config_path) {
        tracing::warn!("Could not save initial config: {}", e);
    }

    // Keep a copy of config for the monitor loop
    let monitor_config = app_config.clone();

    // 4. Build shared state
    let app_state = AppState::new(app_config, data_dir);
    let nvml_for_monitor = Arc::clone(&app_state.nvml);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Cache
            commands::cache::scan_caches,
            commands::cache::clean_caches,
            commands::cache::scan_system_cache,
            commands::cache::clean_system_cache,
            // GPU
            commands::gpu::detect_gpus,
            commands::gpu::scan_gpu_cache,
            commands::gpu::clean_gpu_cache,
            // Monitor
            commands::monitor::get_system_metrics,
            // Services
            commands::services::list_services,
            commands::services::toggle_service,
            // Startup
            commands::startup::list_startup_items,
            commands::startup::toggle_startup_item,
            // Developer (legacy + Epic 9)
            commands::developer::scan_dev_caches,
            commands::developer::clean_dev_caches,
            commands::developer::detect_dev_tools,
            commands::developer::scan_node_modules,
            commands::developer::cancel_dev_scan,
            commands::developer::clean_node_modules,
            commands::developer::scan_js_caches,
            commands::developer::clean_js_caches,
            commands::developer::scan_docker_usage,
            commands::developer::prune_docker,
            commands::developer::scan_language_caches,
            commands::developer::clean_language_caches,
            commands::developer::detect_wsl2_distributions,
            commands::developer::compact_wsl2_vhdx,
            // Gaming Mode
            commands::gaming::get_gaming_mode_status,
            commands::gaming::preview_gaming_mode,
            commands::gaming::activate_gaming_mode,
            commands::gaming::deactivate_gaming_mode,
            commands::gaming::restore_from_snapshot,
            commands::gaming::dismiss_gaming_restore,
            commands::gaming::set_game_process_priority,
            commands::gaming::add_game_config,
            commands::gaming::remove_game_config,
            commands::gaming::list_game_configs,
            commands::gaming::update_gaming_options,
            // Config
            commands::config::get_app_config,
            commands::config::update_app_config,
            // Elevation
            commands::elevation::is_elevated,
            commands::elevation::request_elevation,
            commands::elevation::get_restored_session,
        ])
        .setup(move |app| {
            // 5. Start the background monitoring loop
            let handle = app.handle().clone();
            modules::system_monitor::start_monitor_loop(
                handle,
                nvml_for_monitor,
                monitor_config,
            );

            // 6. Game process watcher — disabled for now, will be enabled via settings
            // TODO: Re-enable when user configures game executables
            // let watcher_handle = app.handle().clone();
            // modules::game_watcher::start_game_process_watcher(watcher_handle);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PurgeKit");
}

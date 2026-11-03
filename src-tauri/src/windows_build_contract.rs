#[test]
fn release_binary_uses_the_windows_gui_subsystem() {
    let main_source = include_str!("main.rs");

    assert!(
        main_source.contains("windows_subsystem = \"windows\""),
        "release builds must not open an extra console window"
    );
}

#[test]
fn position_poll_reuses_the_known_track_id_without_searching() {
    let source = include_str!("player_windows.rs");
    let body = source
        .split("pub(crate) fn get_player_position")
        .nth(1)
        .expect("Windows position function must exist")
        .split("pub(crate) fn control_player")
        .next()
        .expect("Windows control function must follow position polling");

    assert!(body.contains("id: known_track_id"));
    assert!(!body.contains("resolve_track_id"));
}

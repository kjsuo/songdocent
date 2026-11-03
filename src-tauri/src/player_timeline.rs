/// Windows reports a snapshot at LastUpdatedTime, not a continuously advancing clock.
pub(crate) fn estimate_position_ms(
    position_ms: u64,
    updated_at_ms: Option<u64>,
    now_ms: u64,
    is_playing: bool,
    playback_rate: Option<f64>,
    end_ms: Option<u64>,
) -> u64 {
    let elapsed_ms = if is_playing {
        updated_at_ms
            .filter(|updated| *updated > 0)
            .map(|updated| now_ms.saturating_sub(updated))
            .unwrap_or(0)
    } else {
        0
    };
    let rate = playback_rate
        .filter(|rate| rate.is_finite() && *rate >= 0.0)
        .unwrap_or(1.0);
    let position = position_ms.saturating_add((elapsed_ms as f64 * rate) as u64);
    end_ms.filter(|end| *end > 0).map_or(position, |end| position.min(end))
}

#[cfg(test)]
mod tests {
    use super::estimate_position_ms;

    #[test]
    fn unchanged_windows_snapshots_keep_advancing_between_polls() {
        let positions: Vec<_> = (0..=4)
            .map(|second| estimate_position_ms(9_500, Some(100_000), 100_000 + second * 1_000, true, None, None))
            .collect();
        assert_eq!(positions, [9_500, 10_500, 11_500, 12_500, 13_500]);
        // A new snapshot continues the same clock instead of reversing at a lyric boundary.
        assert_eq!(estimate_position_ms(13_500, Some(104_000), 105_000, true, None, None), 14_500);
    }

    #[test]
    fn pause_and_real_backward_seeks_are_preserved() {
        assert_eq!(estimate_position_ms(9_500, Some(100_000), 110_000, false, None, None), 9_500);
        assert_eq!(estimate_position_ms(2_000, Some(110_000), 110_500, true, None, None), 2_500);
    }

    #[test]
    fn invalid_timestamps_do_not_create_progress() {
        for updated in [None, Some(0), Some(111_000)] {
            assert_eq!(estimate_position_ms(9_500, updated, 110_000, true, None, None), 9_500);
        }
    }

    #[test]
    fn respects_playback_speed_and_track_end() {
        assert_eq!(estimate_position_ms(9_500, Some(100_000), 101_000, true, Some(2.0), None), 11_500);
        assert_eq!(estimate_position_ms(9_500, Some(100_000), 101_000, true, Some(0.0), None), 9_500);
        assert_eq!(estimate_position_ms(9_500, Some(100_000), 101_000, true, Some(f64::NAN), Some(10_000)), 10_000);
        assert_eq!(estimate_position_ms(u64::MAX, Some(1), u64::MAX, true, Some(2.0), None), u64::MAX);
    }
}

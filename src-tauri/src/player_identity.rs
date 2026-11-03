#![cfg_attr(not(target_os = "windows"), allow(dead_code))]

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum PlayerSource {
    Spotify,
    AppleMusic,
}

impl PlayerSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Spotify => "spotify",
            Self::AppleMusic => "apple_music",
        }
    }
}

pub fn classify_source_app_id(value: &str) -> Option<PlayerSource> {
    let normalized = value.trim().to_ascii_lowercase();
    if normalized.contains("spotify") {
        Some(PlayerSource::Spotify)
    } else if normalized.contains("applemusic") || normalized.contains("apple.music") {
        Some(PlayerSource::AppleMusic)
    } else {
        None
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrackMetadata {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: Option<u64>,
}

impl TrackMetadata {
    pub fn new(title: &str, artist: &str, album: Option<&str>, duration_ms: Option<u64>) -> Self {
        Self {
            title: title.trim().to_string(),
            artist: artist.trim().to_string(),
            album: album
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string),
            duration_ms,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpotifyCandidate {
    pub id: String,
    pub title: String,
    pub artists: Vec<String>,
    pub album: Option<String>,
    pub duration_ms: u64,
}

impl SpotifyCandidate {
    #[cfg(test)]
    pub fn new(
        id: &str,
        title: &str,
        artists: Vec<&str>,
        album: Option<&str>,
        duration_ms: u64,
    ) -> Self {
        Self {
            id: id.trim().to_string(),
            title: title.trim().to_string(),
            artists: artists
                .into_iter()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect(),
            album: album
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string),
            duration_ms,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MatchScore {
    pub value: i32,
    pub artist_matches: bool,
    pub duration_delta_ms: Option<u64>,
}

impl MatchScore {
    pub fn is_confident(self) -> bool {
        self.artist_matches
            && self.value >= 95
            && self
                .duration_delta_ms
                .is_none_or(|difference| difference <= 5_000)
    }
}

pub fn score_spotify_candidate(query: &TrackMetadata, candidate: &SpotifyCandidate) -> MatchScore {
    let query_title = normalize_match_text(&query.title);
    let candidate_title = normalize_match_text(&candidate.title);
    let title_score = if query_title == candidate_title {
        60
    } else if !query_title.is_empty()
        && (query_title.contains(&candidate_title) || candidate_title.contains(&query_title))
    {
        45
    } else {
        0
    };

    let artist_matches = artist_metadata_matches(&query.artist, &candidate.artists);
    let artist_score = if artist_matches { 50 } else { 0 };

    let album_score = match (query.album.as_deref(), candidate.album.as_deref()) {
        (Some(query_album), Some(candidate_album))
            if normalize_match_text(query_album) == normalize_match_text(candidate_album) =>
        {
            15
        }
        _ => 0,
    };

    let duration_delta_ms = query
        .duration_ms
        .map(|duration| duration.abs_diff(candidate.duration_ms));
    let duration_score = match duration_delta_ms {
        Some(0..=1_500) => 15,
        Some(1_501..=5_000) => 5,
        Some(_) => -30,
        None => 0,
    };

    MatchScore {
        value: title_score + artist_score + album_score + duration_score,
        artist_matches,
        duration_delta_ms,
    }
}

pub fn metadata_fingerprint(source: PlayerSource, track: &TrackMetadata) -> String {
    let album = track
        .album
        .as_deref()
        .map(normalize_match_text)
        .unwrap_or_default();
    let duration_bucket = track.duration_ms.map(|value| value / 5_000).unwrap_or(0);
    format!(
        "{}|{}|{}|{}|{}",
        source.as_str(),
        normalize_match_text(&track.title),
        normalize_match_text(&track.artist),
        album,
        duration_bucket
    )
}

pub fn winrt_ticks_to_ms(ticks: i64) -> u64 {
    if ticks <= 0 {
        0
    } else {
        (ticks as u64) / 10_000
    }
}

pub fn ms_to_winrt_ticks(ms: u64) -> i64 {
    ms.saturating_mul(10_000).min(i64::MAX as u64) as i64
}

fn normalize_match_text(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_alphanumeric() {
                character
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn artist_metadata_matches(query_artist: &str, candidate_artists: &[String]) -> bool {
    let query_artist = normalize_match_text(query_artist);
    if query_artist.is_empty() {
        return false;
    }

    let candidate_artists = candidate_artists
        .iter()
        .map(|artist| normalize_match_text(artist))
        .filter(|artist| !artist.is_empty())
        .collect::<Vec<_>>();
    candidate_artists
        .iter()
        .any(|artist| artist == &query_artist)
        || (!candidate_artists.is_empty() && candidate_artists.join(" ") == query_artist)
        || (candidate_artists.len() > 1
            && candidate_artists
                .iter()
                .all(|artist| query_artist.contains(artist)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_native_spotify_and_apple_music_sessions() {
        assert_eq!(
            classify_source_app_id("Spotify.exe"),
            Some(PlayerSource::Spotify)
        );
        assert_eq!(
            classify_source_app_id("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify"),
            Some(PlayerSource::Spotify)
        );
        assert_eq!(
            classify_source_app_id("AppleMusicWin.exe"),
            Some(PlayerSource::AppleMusic)
        );
        assert_eq!(classify_source_app_id("Chrome.exe"), None);
    }

    #[test]
    fn accepts_close_spotify_metadata_match() {
        let query = TrackMetadata::new(
            "Birds of a Feather",
            "Billie Eilish",
            Some("Hit Me Hard and Soft"),
            Some(210_000),
        );
        let candidate = SpotifyCandidate::new(
            "abc",
            "BIRDS OF A FEATHER",
            vec!["Billie Eilish"],
            Some("HIT ME HARD AND SOFT"),
            210_400,
        );

        assert!(score_spotify_candidate(&query, &candidate).is_confident());
    }

    #[test]
    fn accepts_title_with_parenthetical_version_difference() {
        let query = TrackMetadata::new(
            "Song Name (Remastered 2011)",
            "Artist",
            Some("Album"),
            Some(180_000),
        );
        let candidate = SpotifyCandidate::new(
            "abc",
            "Song Name - Remastered 2011",
            vec!["Artist"],
            Some("Album"),
            180_800,
        );

        assert!(score_spotify_candidate(&query, &candidate).is_confident());
    }

    #[test]
    fn accepts_combined_query_artist_for_collaborations() {
        let query = TrackMetadata::new(
            "Die With A Smile",
            "Lady Gaga, Bruno Mars",
            None,
            Some(251_667),
        );
        let candidate = SpotifyCandidate::new(
            "abc",
            "Die With A Smile",
            vec!["Lady Gaga", "Bruno Mars"],
            None,
            251_667,
        );

        assert!(score_spotify_candidate(&query, &candidate).is_confident());
    }

    #[test]
    fn rejects_wrong_artist_even_when_title_matches() {
        let query = TrackMetadata::new("Hello", "Adele", Some("25"), Some(295_000));
        let candidate = SpotifyCandidate::new(
            "wrong",
            "Hello",
            vec!["Lionel Richie"],
            Some("Can't Slow Down"),
            295_000,
        );

        assert!(!score_spotify_candidate(&query, &candidate).is_confident());
    }

    #[test]
    fn rejects_large_duration_mismatch() {
        let query = TrackMetadata::new("Hello", "Adele", Some("25"), Some(295_000));
        let candidate =
            SpotifyCandidate::new("wrong-version", "Hello", vec!["Adele"], Some("25"), 240_000);

        assert!(!score_spotify_candidate(&query, &candidate).is_confident());
    }

    #[test]
    fn fingerprint_is_stable_across_case_and_punctuation() {
        let first = TrackMetadata::new("Hello!", "ADELE", Some("25"), Some(295_400));
        let second = TrackMetadata::new(" hello ", "Adele", Some("25"), Some(295_900));

        assert_eq!(
            metadata_fingerprint(PlayerSource::Spotify, &first),
            metadata_fingerprint(PlayerSource::Spotify, &second)
        );
    }

    #[test]
    fn converts_winrt_ticks_without_overflow() {
        assert_eq!(winrt_ticks_to_ms(10_000_000), 1_000);
        assert_eq!(winrt_ticks_to_ms(-1), 0);
        assert_eq!(ms_to_winrt_ticks(u64::MAX), i64::MAX);
    }
}

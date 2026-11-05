use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc, LazyLock, Mutex,
};
use std::time::{Duration, Instant};

static REQUESTS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
#[cfg(unix)]
static PROCESSES: LazyLock<Mutex<HashMap<String, u32>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
const OUTPUT_LIMIT: usize = 8 * 1024 * 1024;

pub struct Request {
    pub id: String,
    cancelled: Arc<AtomicBool>,
}

impl Request {
    pub fn new(id: String) -> Result<Self, String> {
        if id.is_empty()
            || id.len() > 160
            || !id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "-_".contains(c))
        {
            return Err("CLI_PROCESS_FAILED: invalid request id".into());
        }
        let mut requests = REQUESTS
            .lock()
            .map_err(|_| "CLI_PROCESS_FAILED: request registry unavailable")?;
        if let Some(previous) = requests.get(&id) {
            if previous.load(Ordering::Relaxed) {
                requests.remove(&id);
                return Err("CLI_CANCELLED: request cancelled before execution".into());
            }
            return Err("CLI_PROCESS_FAILED: duplicate request id".into());
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        requests.insert(id.clone(), cancelled.clone());
        Ok(Self { id, cancelled })
    }
    pub fn check(&self) -> Result<(), String> {
        if self.cancelled.load(Ordering::Relaxed) {
            Err("CLI_CANCELLED: request cancelled".into())
        } else {
            Ok(())
        }
    }
}
impl Drop for Request {
    fn drop(&mut self) {
        if let Ok(mut requests) = REQUESTS.lock() {
            requests.remove(&self.id);
        }
    }
}
pub fn cancel(id: &str) {
    if let Ok(mut requests) = REQUESTS.lock() {
        // A frontend cancellation can arrive while spawn_blocking is still queued.
        if requests.len() >= 2048 {
            requests.retain(|_, flag| !flag.load(Ordering::Relaxed));
        }
        requests
            .entry(id.into())
            .or_insert_with(|| Arc::new(AtomicBool::new(false)))
            .store(true, Ordering::Relaxed);
    }
}
pub fn cancel_all() {
    if let Ok(requests) = REQUESTS.lock() {
        for flag in requests.values() {
            flag.store(true, Ordering::Relaxed);
        }
    }
    #[cfg(unix)]
    if let Ok(processes) = PROCESSES.lock() {
        for pid in processes.values() {
            unsafe {
                libc::kill(-(*pid as i32), libc::SIGKILL);
            }
        }
    }
}

#[cfg(unix)]
struct ProcessRegistration(String);
#[cfg(unix)]
impl Drop for ProcessRegistration {
    fn drop(&mut self) {
        if let Ok(mut processes) = PROCESSES.lock() {
            processes.remove(&self.0);
        }
    }
}

struct ChildGuard {
    child: Child,
    #[cfg(windows)]
    job: windows::Win32::Foundation::HANDLE,
}
impl ChildGuard {
    fn spawn(command: &mut Command) -> Result<Self, String> {
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("CLI_PROCESS_FAILED: {e}"))?;
        #[cfg(windows)]
        {
            use std::os::windows::io::AsRawHandle;
            use windows::Win32::{Foundation::HANDLE, System::JobObjects::*};
            let setup = unsafe {
                CreateJobObjectW(None, None).and_then(|job| {
                    let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
                    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                    let result = SetInformationJobObject(
                        job,
                        JobObjectExtendedLimitInformation,
                        &limits as *const _ as *const _,
                        std::mem::size_of_val(&limits) as u32,
                    )
                    .and_then(|_| AssignProcessToJobObject(job, HANDLE(child.as_raw_handle())));
                    if let Err(e) = result {
                        let _ = windows::Win32::Foundation::CloseHandle(job);
                        return Err(e);
                    }
                    Ok(job)
                })
            };
            match setup {
                Ok(job) => return Ok(Self { child, job }),
                Err(e) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!("CLI_PROCESS_FAILED: process isolation: {e}"));
                }
            }
        }
        #[cfg(not(windows))]
        {
            let _ = &mut child;
            Ok(Self { child })
        }
    }
}
impl Drop for ChildGuard {
    fn drop(&mut self) {
        #[cfg(unix)]
        unsafe {
            libc::kill(-(self.child.id() as i32), libc::SIGKILL);
        }
        #[cfg(windows)]
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self.job);
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

struct CapturedOutput {
    stdout: String,
    stderr: String,
}

fn cli_search_path(executable: &Path) -> Result<std::ffi::OsString, String> {
    let mut paths = Vec::new();
    if let Some(parent) = executable.parent().filter(|parent| parent.is_absolute()) {
        paths.push(parent.to_path_buf());
    }
    for path in super::search_paths() {
        if path.is_absolute() && !paths.contains(&path) {
            paths.push(path);
        }
    }
    std::env::join_paths(paths)
        .map_err(|_| "CLI_PROCESS_FAILED: invalid CLI runtime search path".to_string())
}

pub fn run(
    path: &Path,
    args: &[String],
    env: &[(String, String)],
    cwd: &Path,
    input: &str,
    timeout: Duration,
    request: &Request,
    on_line: impl FnMut(&str) -> Result<(), String>,
) -> Result<String, String> {
    run_captured(path, args, env, cwd, input, timeout, request, on_line)
        .map(|output| output.stdout)
}

pub fn probe(
    path: &Path,
    args: &[String],
    cwd: &Path,
    timeout: Duration,
    request: &Request,
) -> Result<String, String> {
    let output = run_captured(path, args, &[], cwd, "", timeout, request, |_| Ok(()))?;
    Ok(format!("{}\n{}", output.stdout, output.stderr))
}

fn run_captured(
    path: &Path,
    args: &[String],
    env: &[(String, String)],
    cwd: &Path,
    input: &str,
    timeout: Duration,
    request: &Request,
    mut on_line: impl FnMut(&str) -> Result<(), String>,
) -> Result<CapturedOutput, String> {
    request.check()?;
    let mut command = Command::new(path);
    command
        .args(args)
        .current_dir(cwd)
        .env("PATH", cli_search_path(path)?)
        .envs(env.iter().cloned())
        .env("NO_COLOR", "1")
        .env("CI", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut process = ChildGuard::spawn(&mut command)?;
    #[cfg(unix)]
    let _registration = {
        PROCESSES
            .lock()
            .map_err(|_| "CLI_PROCESS_FAILED: process registry unavailable")?
            .insert(request.id.clone(), process.child.id());
        ProcessRegistration(request.id.clone())
    };
    let stdin = process
        .child
        .stdin
        .take()
        .ok_or("CLI_PROCESS_FAILED: no stdin")?;
    let stdout = process
        .child
        .stdout
        .take()
        .ok_or("CLI_PROCESS_FAILED: no stdout")?;
    let stderr = process
        .child
        .stderr
        .take()
        .ok_or("CLI_PROCESS_FAILED: no stderr")?;
    let input = input.to_owned();
    let hold_input = args.first().is_some_and(|arg| arg == "app-server");
    let finished = Arc::new(AtomicBool::new(false));
    let input_finished = finished.clone();
    let writer = std::thread::spawn(move || {
        let mut stdin = stdin;
        let result = stdin
            .write_all(input.as_bytes())
            .and_then(|_| stdin.flush());
        while hold_input && !input_finished.load(Ordering::Relaxed) {
            std::thread::sleep(Duration::from_millis(10));
        }
        result
    });
    let (tx, rx) = mpsc::sync_channel(64);
    let reader = std::thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut total = 0;
        loop {
            let mut line = Vec::new();
            let result = reader
                .by_ref()
                .take((OUTPUT_LIMIT + 1) as u64)
                .read_until(b'\n', &mut line);
            match result {
                Ok(0) => break,
                Ok(_) => {
                    total += line.len();
                    if total > OUTPUT_LIMIT {
                        let _ = tx.send(Err("CLI_RESPONSE_INVALID: output too large".to_owned()));
                        break;
                    }
                    let line = String::from_utf8(line)
                        .map_err(|_| "CLI_RESPONSE_INVALID: invalid UTF-8".to_owned());
                    if tx.send(line).is_err() {
                        break;
                    }
                }
                Err(e) => {
                    let _ = tx.send(Err(format!("CLI_PROCESS_FAILED: stdout: {e}")));
                    break;
                }
            }
        }
    });
    let err_reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let mut stderr = stderr;
        let mut buffer = [0; 4096];
        while let Ok(n) = stderr.read(&mut buffer) {
            if n == 0 {
                break;
            }
            bytes.extend_from_slice(&buffer[..n]);
            if bytes.len() > 65536 {
                bytes.drain(..bytes.len() - 65536);
            }
        }
        String::from_utf8_lossy(&bytes).to_string()
    });
    let started = Instant::now();
    let result = (|| {
        let mut output = String::new();
        loop {
            request.check()?;
            if started.elapsed() > timeout {
                return Err("CLI_TIMEOUT: request timed out".into());
            }
            match rx.recv_timeout(Duration::from_millis(25)) {
                Ok(line) => {
                    let line = line?;
                    on_line(line.trim_end())?;
                    output.push_str(&line);
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        loop {
            request.check()?;
            if started.elapsed() > timeout {
                return Err("CLI_TIMEOUT: request timed out".into());
            }
            if let Some(status) = process
                .child
                .try_wait()
                .map_err(|e| format!("CLI_PROCESS_FAILED: {e}"))?
            {
                return if status.success() {
                    Ok(output)
                } else {
                    Err("CLI_PROCESS_FAILED: CLI exited unsuccessfully".into())
                };
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    })();
    drop(process);
    finished.store(true, Ordering::Relaxed);
    drop(rx);
    let _ = reader.join();
    let _ = writer.join();
    let stderr = err_reader.join().unwrap_or_default();
    let stdout = result.map_err(|error: String| {
        if error.starts_with("CLI_PROCESS_FAILED") && !stderr.trim().is_empty() {
            super::classify_error(&stderr)
        } else {
            error
        }
    })?;
    Ok(CapturedOutput { stdout, stderr })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    #[test]
    fn launches_cli_with_a_runtime_installed_beside_it() {
        use std::os::unix::fs::PermissionsExt;

        let installation = tempfile::tempdir().unwrap();
        let working_dir = tempfile::tempdir().unwrap();
        let executable = installation.path().join("cli-fixture");
        let runtime = installation.path().join("songdocent-fixture-runtime");
        std::fs::write(&executable, "#!/usr/bin/env songdocent-fixture-runtime\n").unwrap();
        std::fs::write(&runtime, "#!/bin/sh\nprintf 'runtime-ready\\n'\n").unwrap();
        for path in [&executable, &runtime] {
            std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let request = Request::new("runtime-path-test".into()).unwrap();
        let output = run(
            &executable, &[], &[], working_dir.path(), "", Duration::from_secs(5),
            &request, |_| Ok(()),
        ).unwrap();
        assert_eq!(output, "runtime-ready\n");
    }

    #[cfg(unix)]
    #[test]
    fn pipes_large_utf8_and_drains_stderr() {
        let dir = tempfile::tempdir().unwrap();
        let request = Request::new("pipe-test".into()).unwrap();
        let input = "가사 日本語 🎵\n".repeat(10000);
        let args = vec!["-c".into(), "head -c 100000 /dev/zero >&2; cat".into()];
        let result = run(
            Path::new("/bin/sh"),
            &args,
            &[],
            dir.path(),
            &input,
            Duration::from_secs(5),
            &request,
            |_| Ok(()),
        )
        .unwrap();
        assert_eq!(result, input);
    }
    #[cfg(unix)]
    #[test]
    fn successful_stderr_is_not_generation_output_or_streamed_lines() {
        let dir = tempfile::tempdir().unwrap();
        let request = Request::new("stdout-only-test".into()).unwrap();
        let mut lines = Vec::new();
        let output = run(
            Path::new("/bin/sh"),
            &["-c".into(), "printf '%s\\n' '{\"ok\":true}'; echo 'unauthorized diagnostic' >&2".into()],
            &[],
            dir.path(),
            "",
            Duration::from_secs(5),
            &request,
            |line| {
                lines.push(line.to_owned());
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(output, "{\"ok\":true}\n");
        assert_eq!(lines, ["{\"ok\":true}"]);
    }

    #[cfg(unix)]
    #[test]
    fn timeout_cleans_up_and_cancellation_is_seen_between_chunks() {
        let dir = tempfile::tempdir().unwrap();
        let request = Request::new("timeout-test".into()).unwrap();
        let result = run(
            Path::new("/bin/sh"),
            &["-c".into(), "sleep 30".into()],
            &[],
            dir.path(),
            "",
            Duration::from_millis(50),
            &request,
            |_| Ok(()),
        );
        assert!(result.unwrap_err().starts_with("CLI_TIMEOUT"));
        cancel(&request.id);
        assert!(request.check().unwrap_err().starts_with("CLI_CANCELLED"));
    }
    #[test]
    fn cancellation_before_worker_registration_is_not_lost() {
        cancel("queued-cli-test");
        assert!(Request::new("queued-cli-test".into())
            .err()
            .unwrap()
            .starts_with("CLI_CANCELLED"));
    }
    #[cfg(unix)]
    #[test]
    fn cancellation_terminates_a_running_child_tree() {
        let request = Request::new("running-cli-test".into()).unwrap();
        let handle = std::thread::spawn(move || {
            let dir = tempfile::tempdir().unwrap();
            run(
                Path::new("/bin/sh"),
                &["-c".into(), "sleep 30 & wait".into()],
                &[],
                dir.path(),
                "",
                Duration::from_secs(10),
                &request,
                |_| Ok(()),
            )
        });
        while !PROCESSES.lock().unwrap().contains_key("running-cli-test") {
            std::thread::sleep(Duration::from_millis(5));
        }
        let start = Instant::now();
        cancel("running-cli-test");
        assert!(handle
            .join()
            .unwrap()
            .unwrap_err()
            .starts_with("CLI_CANCELLED"));
        assert!(start.elapsed() < Duration::from_secs(2));
    }
}

use std::{env, fs};

use zed_extension_api::{self as zed, Result};

/// The repository the server binary is released from.
const REPOSITORY: &str = "soymadip/portosaur";

/// The release tag for the server version this extension ships.
/// The extension version and the server version are the same number.
fn release_tag() -> String {
    format!("lsp-v{}", env!("CARGO_PKG_VERSION"))
}

struct PortosaurExtension {
    cached_binary_path: Option<String>,
}

impl PortosaurExtension {
    /// The release asset name for the platform Zed is running on.
    fn asset_name() -> Result<String> {
        let (os, arch) = zed::current_platform();
        let target = match (os, arch) {
            (zed::Os::Mac, zed::Architecture::Aarch64) => "darwin_arm64",
            (zed::Os::Mac, zed::Architecture::X8664) => "darwin_amd64",
            (zed::Os::Linux, zed::Architecture::X8664) => "linux_amd64",
            (zed::Os::Linux, zed::Architecture::Aarch64) => "linux_arm64",
            (zed::Os::Windows, zed::Architecture::X8664) => "windows_amd64",
            _ => {
                return Err(
                    "Portosaur does not ship a language server binary for this platform yet"
                        .to_string(),
                );
            }
        };
        let suffix = if os == zed::Os::Windows { ".exe" } else { "" };
        Ok(format!("porto-lsp_{target}{suffix}"))
    }

    /// The downloaded binary, fetched from the GitHub release on first use
    /// and kept under a versioned directory so an extension update picks up
    /// the matching server.
    fn binary_path(&mut self, language_server_id: &zed::LanguageServerId) -> Result<String> {
        if let Some(path) = &self.cached_binary_path
            && fs::metadata(path).is_ok_and(|stat| stat.is_file())
        {
            return Ok(path.clone());
        }

        let asset_name = Self::asset_name()?;
        let version_dir = format!("porto-lsp-{}", env!("CARGO_PKG_VERSION"));
        let binary_path = format!("{version_dir}/{asset_name}");
        if fs::metadata(&binary_path).is_ok_and(|stat| stat.is_file()) {
            self.cached_binary_path = Some(binary_path.clone());
            return Ok(binary_path);
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::Downloading,
        );
        let release = zed::github_release_by_tag_name(REPOSITORY, &release_tag())
            .map_err(|err| format!("failed to find the {REPOSITORY} release: {err}"))?;
        let asset = release
            .assets
            .iter()
            .find(|asset| asset.name == asset_name)
            .ok_or_else(|| format!("release {} has no asset named {asset_name}", release_tag()))?;

        fs::create_dir_all(&version_dir)
            .map_err(|err| format!("failed to create {version_dir}: {err}"))?;
        zed::download_file(
            &asset.download_url,
            &binary_path,
            zed::DownloadedFileType::Uncompressed,
        )
        .map_err(|err| format!("failed to download {asset_name}: {err}"))?;
        zed::make_file_executable(&binary_path)?;

        self.cached_binary_path = Some(binary_path.clone());
        Ok(binary_path)
    }
}

impl zed::Extension for PortosaurExtension {
    fn new() -> Self {
        Self {
            cached_binary_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let binary_path = self.binary_path(language_server_id)?;
        Ok(zed::Command {
            command: env::current_dir()
                .map_err(|err| format!("failed to resolve the extension directory: {err}"))?
                .join(&binary_path)
                .to_string_lossy()
                .to_string(),
            args: vec!["--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(PortosaurExtension);

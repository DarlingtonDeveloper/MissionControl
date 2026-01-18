class MissionControl < Formula
  desc "AI agent orchestration system with Claude Code integration"
  homepage "https://github.com/DarlingtonDeveloper/MissionControl"
  version "0.5.0"

  # Platform-specific binaries
  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/DarlingtonDeveloper/MissionControl/releases/download/v#{version}/mission-control-#{version}-darwin-arm64.tar.gz"
      sha256 "PLACEHOLDER_SHA256_ARM64"
    else
      url "https://github.com/DarlingtonDeveloper/MissionControl/releases/download/v#{version}/mission-control-#{version}-darwin-amd64.tar.gz"
      sha256 "PLACEHOLDER_SHA256_AMD64"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/DarlingtonDeveloper/MissionControl/releases/download/v#{version}/mission-control-#{version}-linux-arm64.tar.gz"
      sha256 "PLACEHOLDER_SHA256_LINUX_ARM64"
    else
      url "https://github.com/DarlingtonDeveloper/MissionControl/releases/download/v#{version}/mission-control-#{version}-linux-amd64.tar.gz"
      sha256 "PLACEHOLDER_SHA256_LINUX_AMD64"
    end
  end

  license "MIT"

  depends_on "go" => :build
  depends_on "rust" => :build
  depends_on "node" => :build

  def install
    # Build mc CLI (Go)
    cd "cmd/mc" do
      system "go", "build", *std_go_args(ldflags: "-s -w -X main.version=#{version}"), "-o", bin/"mc"
    end

    # Build mc-core (Rust)
    cd "core" do
      system "cargo", "build", "--release", "-p", "mc-core"
      bin.install "target/release/mc-core"
    end

    # Build orchestrator (Go)
    cd "orchestrator" do
      system "go", "build", *std_go_args(ldflags: "-s -w"), "-o", bin/"mc-orchestrator"
    end

    # Build web UI
    cd "web" do
      system "npm", "install"
      system "npm", "run", "build"
      # Install static files
      (share/"mission-control/web").install "dist/."
    end

    # Install templates
    (share/"mission-control").install "templates" if Dir.exist?("templates")
  end

  def caveats
    <<~EOS
      MissionControl has been installed!

      Quick start:
        1. Navigate to your project directory
        2. Run: mc init
        3. Run: claude (starts King mode)

      The orchestrator can be started with:
        mc-orchestrator

      Web UI files are installed at:
        #{share}/mission-control/web

      For more information, visit:
        https://github.com/DarlingtonDeveloper/MissionControl
    EOS
  end

  test do
    # Test mc CLI
    assert_match "mc is the command-line interface", shell_output("#{bin}/mc --help")

    # Test mc-core
    assert_match "MissionControl core CLI", shell_output("#{bin}/mc-core --help")

    # Test init creates .mission directory
    system bin/"mc", "init"
    assert_predicate testpath/".mission", :exist?
    assert_predicate testpath/".mission/CLAUDE.md", :exist?
    assert_predicate testpath/".mission/state/phase.json", :exist?
  end
end

use clap::{Parser, Subcommand};
use mc_protocol::{conversation, protocol, tokens, watcher};
use serde::Serialize;
use std::path::Path;
use std::time::Duration;

#[derive(Parser)]
#[command(name = "mc-protocol")]
#[command(about = "MissionControl file-based protocol detection")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Watch for task completion (blocks until status file appears or timeout)
    WatchTask {
        #[arg(long)]
        task_id: String,
        #[arg(long, default_value = ".mission")]
        mission_dir: String,
        #[arg(long, default_value = "300")]
        timeout: u64,
    },
    /// Watch for conversation response (blocks until ---END--- marker or timeout)
    WatchConversation {
        #[arg(long, default_value = ".mission")]
        mission_dir: String,
        #[arg(long, default_value = "300")]
        timeout: u64,
    },
    /// Validate task file format
    ValidateTask {
        #[arg(long)]
        file: String,
    },
    /// Parse response file
    ParseResponse {
        #[arg(long)]
        file: String,
    },
    /// Watch conversation.md and report token usage
    WatchTokens {
        #[arg(long, default_value = ".mission")]
        mission_dir: String,
        #[arg(long, default_value = "300")]
        timeout: u64,
    },
    /// Count tokens in conversation.md (one-shot, no watching)
    CountTokens {
        #[arg(long, default_value = ".mission")]
        mission_dir: String,
    },
}

#[derive(Serialize)]
struct ErrorOutput {
    error: String,
}

fn main() {
    let cli = Cli::parse();

    let result: Result<String, Box<dyn std::error::Error>> = match cli.command {
        Commands::WatchTask {
            task_id,
            mission_dir,
            timeout,
        } => watcher::watch_task(&task_id, &mission_dir, Duration::from_secs(timeout))
            .map(|r| serde_json::to_string(&r).unwrap()),

        Commands::WatchConversation {
            mission_dir,
            timeout,
        } => conversation::watch(&mission_dir, Duration::from_secs(timeout))
            .map(|r| serde_json::to_string(&r).unwrap()),

        Commands::ValidateTask { file } => {
            protocol::validate_task(&file).map(|r| serde_json::to_string(&r).unwrap())
        }

        Commands::ParseResponse { file } => {
            protocol::parse_response(&file).map(|r| serde_json::to_string(&r).unwrap())
        }

        Commands::WatchTokens {
            mission_dir,
            timeout,
        } => tokens::watch_conversation_tokens(Path::new(&mission_dir), timeout)
            .map(|r| serde_json::to_string(&r).unwrap())
            .map_err(|e| e.into()),

        Commands::CountTokens { mission_dir } => {
            let path = Path::new(&mission_dir).join("conversation.md");
            tokens::count_tokens(&path)
                .map(|r| serde_json::to_string(&r).unwrap())
                .map_err(|e| e.into())
        }
    };

    match result {
        Ok(output) => {
            println!("{}", output);
            std::process::exit(0);
        }
        Err(e) => {
            let error_output = ErrorOutput {
                error: e.to_string(),
            };
            eprintln!("{}", serde_json::to_string(&error_output).unwrap());
            std::process::exit(1);
        }
    }
}
